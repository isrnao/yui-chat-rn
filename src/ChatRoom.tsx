import { useId, useRef, useEffect, useCallback } from "react";
import type { ChangeEvent, FormEvent } from "react";
import ChatLogList from "./ChatLogList";
import type { Chat } from "./YuiChat";

export type ChatRoomProps = {
  name: string;
  color: string;
  windowRows: number;
  chatLog: Chat[];
  setChatLog: (log: Chat[]) => void;
  message: string;
  setMessage: (v: string) => void;
  onExit: () => void;
  onSend: (e: FormEvent) => void;
  isPending: boolean;
};

export default function ChatRoom({
  name,
  color,
  windowRows,
  chatLog,
  setChatLog,
  message,
  setMessage,
  onExit,
  onSend,
  isPending,
}: ChatRoomProps) {
  const messageId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isPending && inputRef.current) inputRef.current.focus();
  }, [chatLog, isPending]);

  const handleMsgChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => setMessage(e.target.value),
    [setMessage]
  );

  return (
    <div
      className="min-h-screen flex flex-col items-center py-8"
      style={{
        background: "var(--tw-color-yui-green, #A1FE9F)",
        fontFamily: "var(--tw-font-yui, sans-serif)",
      }}
    >
      <div className="flex items-center justify-between w-full max-w-2xl px-4 pt-3 pb-2">
        <div className="text-2xl font-bold" style={{ color: "#ff69b4" }}>
          ゆいちゃっと
        </div>
        <button
          className="bg-blue-200 text-blue-700 px-2 py-1 rounded-lg text-xs font-bold shadow"
          onClick={onExit}
        >
          退室する
        </button>
      </div>
      <div className="text-sm mt-1 mb-1 w-full max-w-2xl px-4">
        参加者：<b>{name}</b>
        <span className="text-gray-500 ml-2">
          （同じブラウザで新タブを開けば複数人扱い！）
        </span>
      </div>
      <hr className="border-yui-pink w-full max-w-2xl" />
      <form
        onSubmit={onSend}
        className="flex items-center gap-2 mt-2 mb-3 w-full max-w-2xl px-4"
        autoComplete="off"
      >
        <input
          type="text"
          className="flex-1 border border-yui-pink px-3 py-1 rounded-lg text-lg"
          placeholder="発言"
          id={messageId}
          value={message}
          maxLength={120}
          onChange={handleMsgChange}
          disabled={isPending}
          ref={inputRef}
        />
        <button
          type="submit"
          className="bg-yui-pink hover:bg-pink-500 text-white px-5 py-2 rounded-2xl font-bold shadow"
          disabled={isPending}
        >
          {isPending ? "送信" : "発言"}
        </button>
        <span className="text-xs text-gray-400 ml-2">
          <b>{windowRows}</b>行表示
        </span>
      </form>
      <ChatLogList chatLog={chatLog} windowRows={windowRows} showHeader={false} />
      <a
        href="http://www.cup.com/yui/"
        target="_blank"
        rel="noreferrer"
        className="fixed right-0 bottom-0 m-4 z-50 text-yui-pink underline text-xs bg-white rounded-xl px-3 py-1 shadow border border-yui-pink-light"
      >
        ゆいちゃっと Pro(Free)
      </a>
    </div>
  );
}
