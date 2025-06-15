import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";

export default function TermsModal({ open, onAgree }: { open: boolean; onAgree: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gpuSupported, setGpuSupported] = useState(true);
  const attackingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) throw new Error("canvasが見つかりません");
    if (!navigator.gpu) {
      setGpuSupported(false);
      return;
    }

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    let device: GPUDevice;
    let context: GPUCanvasContext;
    let uniformBuffer: GPUBuffer;
    let pipeline: GPURenderPipeline;
    let uniformBindGroup: GPUBindGroup;
    let start = 0;
    let u_attack = 0;
    let raf = 0;

    const init = async () => {
      const adapter = await navigator.gpu!.requestAdapter();
      if (!adapter) return;
      device = await adapter.requestDevice();
      context = canvas.getContext("webgpu")!;
      const format = navigator.gpu!.getPreferredCanvasFormat();
      context.configure({ device, format, alphaMode: "premultiplied" });

      uniformBuffer = device.createBuffer({
        size: 4 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const shaderModule = device.createShaderModule({
        code: `
        struct Uniforms {
          u_time: f32,
          u_attack: f32,
          u_width: f32,
          u_height: f32,
        };
        @group(0) @binding(0) var<uniform> u: Uniforms;
        fn random2(st: vec2<f32>) -> f32 {
          return fract(sin(dot(st, vec2<f32>(12.9898,78.233))) * 43758.5453123);
        }
        fn noise(st: vec2<f32>) -> f32 {
          let i = floor(st);
          let f = fract(st);
          let u_ = f * f * (3.0 - 2.0 * f);
          return mix(mix(random2(i), random2(i + vec2<f32>(1.0,0.0)), u_.x),
                    mix(random2(i + vec2<f32>(0.0,1.0)), random2(i + vec2<f32>(1.0,1.0)), u_.x),
                    u_.y);
        }
        fn tear(uv: vec2<f32>, origin: vec2<f32>, angle: f32, width: f32, jag: f32) -> f32 {
          let o = uv - origin;
          let s = sin(angle);
          let c = cos(angle);
          let r = vec2<f32>(o.x * c - o.y * s, o.x * s + o.y * c);
          let j = noise(r * jag) * 0.02;
          return smoothstep(width, width * 0.5, abs(r.y + j));
        }
        @vertex
        fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4<f32> {
          var pos = array<vec2<f32>, 6>(
            vec2<f32>(-1.0,-1.0), vec2<f32>(1.0,-1.0), vec2<f32>(-1.0,1.0),
            vec2<f32>(-1.0,1.0), vec2<f32>(1.0,-1.0), vec2<f32>(1.0,1.0)
          );
          return vec4<f32>(pos[i], 0.0, 1.0);
        }
        @fragment
        fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
          let uv = fragCoord.xy / vec2<f32>(u.u_width, u.u_height);
          var col = vec3<f32>(1.0);
          var a = 1.0;
          let atk = smoothstep(0.0, 1.0, u.u_attack);
          var claw = 0.0;
          claw += tear(uv, vec2<f32>(0.4,0.3), 1.0, 0.015, 50.0);
          claw += tear(uv, vec2<f32>(0.5,0.5), 0.9, 0.015, 60.0);
          claw += tear(uv, vec2<f32>(0.6,0.7), 0.8, 0.015, 70.0);
          let visible = smoothstep(0.1, 0.4, atk);
          col = mix(col, mix(vec3<f32>(0.6,0.0,0.0), vec3<f32>(0.1,0.02,0.01), atk), claw * visible);
          let collapse = smoothstep(0.4, 1.0, atk);
          let crumble = clamp(claw * collapse * 5.0, 0.0, 1.0);
          a *= 1.0 - crumble;
          if(a < 0.01) { discard; }
          return vec4<f32>(col, a);
        }
        `,
      });

      pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: { module: shaderModule, entryPoint: "vs" },
        fragment: { module: shaderModule, entryPoint: "fs", targets: [{ format }] },
        primitive: { topology: "triangle-list" },
      });

      uniformBindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
      });

      const render = (ts: number) => {
        if (!start) start = ts;
        const t = (ts - start) / 1000;
        if (attackingRef.current && u_attack < 1)
          u_attack = Math.min(u_attack + 0.02, 1);

        device.queue.writeBuffer(
          uniformBuffer,
          0,
          new Float32Array([t, u_attack, canvas.width, canvas.height]),
        );

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: context.getCurrentTexture().createView(),
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              loadOp: "clear",
              storeOp: "store",
            },
          ],
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, uniformBindGroup);
        pass.draw(6);
        pass.end();
        device.queue.submit([encoder.finish()]);

        if (u_attack < 1) {
          raf = requestAnimationFrame(render);
        } else {
          onAgree();
        }
      };

      raf = requestAnimationFrame(render);
    };

    init();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [open, onAgree]);

  return (
    <Modal open={open} ariaLabel="利用規約への同意" className="max-w-lg w-[80%]  h-[80%] bg-white/90 text-black p-4 rounded" onClose={gpuSupported ? undefined : onAgree}>
      {gpuSupported && (
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      )}
      <div className="relative z-10 max-h-[65vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-2">利用規約</h2>
        <p className="mb-2 text-sm">
          本サービス（以下「当サイト」）は、利用者同士のコミュニケーションを目的としたチャットサービスです。
          利用にあたっては、下記の内容に同意したものとみなします。
        </p>
        <ol className="list-decimal ml-5 mb-2 text-sm space-y-2">
          <li>
            <b>禁止事項</b>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>法令または公序良俗に反する行為</li>
              <li>他の利用者や第三者への誹謗中傷・差別・いやがらせ</li>
              <li>スパム、広告、宣伝、勧誘行為</li>
              <li>他人になりすます行為</li>
              <li>個人情報や機密情報の投稿</li>
              <li>不適切なコンテンツの投稿</li>
            </ul>
          </li>
          <li>
            <b>免責事項</b>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>
                当サイトは、投稿内容の監視・保証は行いません。利用者間のトラブルや損害について、運営は一切の責任を負いません。
              </li>
              <li>
                不適切な投稿や違反が判明した場合、投稿削除・利用停止などの措置を行う場合があります。
              </li>
            </ul>
          </li>
          <li>
            <b>個人情報の取り扱い</b>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>
                利用者が投稿した内容は、他の利用者に表示されることがあります。投稿の際は個人情報を含めないようご注意ください。
              </li>
            </ul>
          </li>
          <li>
            <b>規約の変更</b>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>
                本規約は予告なく変更される場合があります。最新の規約は当サイト上にて随時公開します。
              </li>
            </ul>
          </li>
        </ol>
        <p className="mb-2 text-xs text-gray-600">
          ※利用規約に同意いただけない場合は、本サービスをご利用いただけません。
        </p>
      </div>
      <div className="relative z-10 mt-4">
        <button
          type="button"
          onClick={() => {
            if (!navigator.gpu) {
              onAgree();
            } else {
              attackingRef.current = true;
            }
          }}
          className="px-4 py-2 bg-red-700 text-white rounded"
        >
          同意して開始
        </button>
      </div>
    </Modal>
  );
}
