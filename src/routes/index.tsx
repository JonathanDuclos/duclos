import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type * as THREE_TYPE from "three";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    let disposed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const THREE = await import("three");
      if (disposed || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x050505);
      scene.fog = new THREE.Fog(0x050505, 4, 22);

      const camera = new THREE.PerspectiveCamera(
        70,
        window.innerWidth / window.innerHeight,
        0.1,
        200,
      );

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);

      // Curved path through the scene
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(6, 2, -18),
        new THREE.Vector3(-6, -2, -38),
        new THREE.Vector3(4, 3, -58),
        new THREE.Vector3(-2, -1, -80),
        new THREE.Vector3(0, 0, -100),
      ]);
      curve.tension = 0.5;

      // Tube along the curve (the "path")
      const tubeGeom = new THREE.TubeGeometry(curve, 400, 0.05, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.25,
      });
      scene.add(new THREE.Mesh(tubeGeom, tubeMat));

      // Rings following the path
      const ringGeom = new THREE.TorusGeometry(1.4, 0.008, 8, 96);
      const ringCount = 90;
      for (let i = 0; i < ringCount; i++) {
        const t = i / (ringCount - 1);
        const pos = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t);
        const mat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.15 + 0.6 * (1 - Math.abs(0.5 - t) * 2),
        });
        const ring = new THREE.Mesh(ringGeom, mat);
        ring.position.copy(pos);
        ring.lookAt(pos.clone().add(tangent));
        scene.add(ring);
      }

      // Floating wireframe shapes near the path
      const shapes: THREE_TYPE.Mesh[] = [];
      const shapeGeoms = [
        new THREE.IcosahedronGeometry(0.9, 0),
        new THREE.OctahedronGeometry(0.8, 0),
        new THREE.TorusKnotGeometry(0.6, 0.15, 80, 12),
        new THREE.BoxGeometry(1, 1, 1),
      ];
      for (let i = 0; i < 24; i++) {
        const t = (i + 1) / 26;
        const base = curve.getPointAt(t);
        const geom = shapeGeoms[i % shapeGeoms.length];
        const mat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          wireframe: true,
          transparent: true,
          opacity: 0.55,
        });
        const mesh = new THREE.Mesh(geom, mat);
        const side = i % 2 === 0 ? 1 : -1;
        mesh.position.set(
          base.x + side * (2.5 + Math.random() * 1.5),
          base.y + (Math.random() - 0.5) * 3,
          base.z + (Math.random() - 0.5) * 4,
        );
        mesh.userData.spin = new THREE.Vector3(
          (Math.random() - 0.5) * 0.005,
          (Math.random() - 0.5) * 0.005,
          (Math.random() - 0.5) * 0.005,
        );
        scene.add(mesh);
        shapes.push(mesh);
      }

      // Starfield dots
      const starGeom = new THREE.BufferGeometry();
      const starCount = 800;
      const positions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 60;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
        positions[i * 3 + 2] = -Math.random() * 110;
      }
      starGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const stars = new THREE.Points(
        starGeom,
        new THREE.PointsMaterial({ color: 0xffffff, size: 0.03, transparent: true, opacity: 0.7 }),
      );
      scene.add(stars);

      let scrollProgress = 0;
      let target = 0;

      const updateProgress = () => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        target = scrollable > 0 ? window.scrollY / scrollable : 0;
        setProgress(target);
      };

      const onResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };

      window.addEventListener("scroll", updateProgress, { passive: true });
      window.addEventListener("resize", onResize);
      updateProgress();

      const tick = () => {
        scrollProgress += (target - scrollProgress) * 0.08;
        const t = Math.min(0.999, Math.max(0.0001, scrollProgress));
        const camPos = curve.getPointAt(t);
        const lookAt = curve.getPointAt(Math.min(0.9999, t + 0.02));
        camera.position.copy(camPos);
        camera.lookAt(lookAt);

        for (const s of shapes) {
          s.rotation.x += s.userData.spin.x;
          s.rotation.y += s.userData.spin.y;
          s.rotation.z += s.userData.spin.z;
        }

        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      tick();

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("scroll", updateProgress);
        window.removeEventListener("resize", onResize);
        renderer.dispose();
        tubeGeom.dispose();
        ringGeom.dispose();
        shapeGeoms.forEach((g) => g.dispose());
        starGeom.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return (
    <div className="relative bg-background text-foreground">
      <canvas
        ref={canvasRef}
        className="fixed inset-0 h-screen w-screen"
        aria-hidden="true"
      />

      {/* Fixed HUD */}
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-5 md:px-12">
        <div className="font-mono text-xs tracking-[0.3em] uppercase text-foreground">
          RC<span className="text-muted-foreground">/dev</span>
        </div>
        <nav className="hidden md:flex gap-8 font-mono text-xs tracking-[0.25em] uppercase text-muted-foreground">
          <a href="#about" className="hover:text-foreground transition-colors">Sobre</a>
          <a href="#portfolio" className="hover:text-foreground transition-colors">Portfólio</a>
          <a href="#contact" className="hover:text-foreground transition-colors">Contato</a>
        </nav>
        <div className="font-mono text-xs tracking-[0.25em] text-muted-foreground tabular-nums">
          {String(Math.round(progress * 100)).padStart(3, "0")}%
        </div>
      </header>

      {/* Progress bar */}
      <div className="fixed left-0 top-0 z-20 h-px w-full bg-border">
        <div
          className="h-full bg-foreground transition-[width] duration-100"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <main className="relative z-10">
        {/* HERO */}
        <section className="flex min-h-screen flex-col justify-center px-6 md:px-16 lg:px-24">
          <p className="font-mono text-xs tracking-[0.4em] uppercase text-muted-foreground mb-6">
            [ 01 — introdução ]
          </p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-light tracking-tight leading-[0.95] max-w-5xl">
            Jonathan Duclos,<br />
            <span className="italic font-serif text-muted-foreground">construindo</span> software<br />
            com intenção.
          </h1>
          <p className="mt-10 max-w-xl text-base md:text-lg text-muted-foreground leading-relaxed">
            Desenvolvedor full-stack focado em interfaces minimalistas,
            experiências robustas e sistemas resilientes. Role a página
            para percorrer o caminho.
          </p>
          <div className="mt-16 font-mono text-xs tracking-[0.3em] uppercase text-muted-foreground animate-pulse">
            ↓ scroll
          </div>
        </section>

        {/* ABOUT */}
        <section id="about" className="min-h-screen flex items-center px-6 md:px-16 lg:px-24 py-24">
          <div className="grid md:grid-cols-12 gap-12 w-full">
            <div className="md:col-span-4">
              <p className="font-mono text-xs tracking-[0.4em] uppercase text-muted-foreground">
                [ 02 — sobre ]
              </p>
              <h2 className="mt-6 text-4xl md:text-5xl font-light">Sobre</h2>
            </div>
            <div className="md:col-span-7 md:col-start-6 space-y-6 text-base md:text-lg leading-relaxed">
              <p>
                Há oito anos desenho e construo produtos digitais — do primeiro
                pixel ao último deploy. Trabalho com <span className="text-foreground">TypeScript</span>,
                <span className="text-foreground"> React + Typescript</span>,{" "}
                <span className="text-foreground">Node</span> e{" "}
                <span className="text-foreground">Three.js</span>.
              </p>
              <p className="text-muted-foreground">
                Meu foco é a fricção entre design e engenharia: interfaces que
                parecem simples, mas escondem arquitetura consistente. Acredito
                em código escrito para ser lido, sistemas que se explicam
                sozinhos e produtos que respeitam quem os usa.
              </p>
              <div className="grid grid-cols-3 gap-6 pt-8 border-t border-border">
                <div>
                  <div className="text-3xl font-light">02</div>
                  <div className="mt-1 font-mono text-xs tracking-[0.2em] uppercase text-muted-foreground">
                    anos
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-light">Vários</div>
                  <div className="mt-1 font-mono text-xs tracking-[0.2em] uppercase text-muted-foreground">
                    projetos
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-light">Leais</div>
                  <div className="mt-1 font-mono text-xs tracking-[0.2em] uppercase text-muted-foreground">
                    clientes
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PORTFOLIO */}
        <section id="portfolio" className="min-h-screen px-6 md:px-16 lg:px-24 py-24">
          <div className="flex items-end justify-between mb-16">
            <div>
              <p className="font-mono text-xs tracking-[0.4em] uppercase text-muted-foreground">
                [ 03 — trabalho ]
              </p>
              <h2 className="mt-6 text-4xl md:text-5xl font-light">Portfólio</h2>
            </div>
            <div className="hidden md:block font-mono text-xs text-muted-foreground">
              04 projetos selecionados
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-px bg-border">
            {[
              {
                n: "01",
                title: "Caso de Ganho",
                tag: "Machine Learning",
                desc: "Um estudo com o uso de ScikitLearn, Python, Pandas, MatplotLib e matematica para varrer uma base de dados e encontrar padrões de comportamento de clientes.",
              },
              {
                n: "02",
                title: "Lanes Recognition",
                tag: "Computational Vision · Python",
                desc: "Sistema para reconhecimento de faixas de rodovias em dash cams de carros, usando OpenCV e técnicas de visão computacional.",
              },
              {
                n: "03",
                title: "Moraes Imobiliária",
                tag: "Landing Page · React + Typescript",
                desc: "Landing page para negocio imobiliario.",
              },
              {
                n: "04",
                title: "Sul Minas IoT",
                tag: "Automacao Industrial · IoT",
                desc: "Um aplicativo de IoT para o controle de Sistema de Irrigação, com monitoramento de sensores e atuadores, usando Node.js, React e MQTT.",
              },
            ].map((p) => (
              <article
                key={p.n}
                className="group bg-background p-8 md:p-10 transition-colors hover:bg-card"
              >
                <div className="flex items-baseline justify-between mb-8">
                  <span className="font-mono text-xs tracking-[0.3em] text-muted-foreground">
                    {p.n}
                  </span>
                  <span className="font-mono text-xs tracking-[0.2em] uppercase text-muted-foreground">
                    {p.tag}
                  </span>
                </div>
                <h3 className="text-3xl md:text-4xl font-light mb-4">
                  {p.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed max-w-md">
                  {p.desc}
                </p>
                <div className="mt-8 inline-flex items-center gap-2 font-mono text-xs tracking-[0.25em] uppercase border-b border-foreground/40 pb-1 group-hover:border-foreground transition-colors">
                  Ver estudo <span>→</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* CONTACT */}
        <section
          id="contact"
          className="min-h-screen flex flex-col justify-center px-6 md:px-16 lg:px-24 py-24"
        >
          <p className="font-mono text-xs tracking-[0.4em] uppercase text-muted-foreground">
            [ 04 — fim do caminho ]
          </p>
          <h2 className="mt-6 text-5xl md:text-7xl lg:text-8xl font-light tracking-tight leading-[0.95] max-w-4xl">
            Vamos <span className="italic font-serif text-muted-foreground">conversar</span>.
          </h2>
          <p className="mt-8 max-w-xl text-lg text-muted-foreground leading-relaxed">
            Aberto a projetos freelance, colaborações e trocas. Escolha o
            canal que preferir — respondo sempre que possível.
          </p>

          <div className="mt-16 grid md:grid-cols-3 gap-px bg-border max-w-4xl">
            {[
              { label: "Email", value: "jonathan.duclos69@gmail.com", href: "mailto:jonathan.duclos69@gmail.com" },
              { label: "Github", value: "@simmookobayashi", href: "https://github.com/JonathanDuclos" },
              { label: "WhatsApp", value: "+55 35 9 8894 4067", href: "https://wa.me/5535988944067" },
            ].map((c) => (
              <a
                key={c.label}
                href={c.href}
                className="bg-background p-8 hover:bg-card transition-colors group"
              >
                <div className="font-mono text-xs tracking-[0.3em] uppercase text-muted-foreground">
                  {c.label}
                </div>
                <div className="mt-4 text-lg group-hover:translate-x-1 transition-transform">
                  {c.value} →
                </div>
              </a>
            ))}
          </div>

          <footer className="mt-24 pt-8 border-t border-border flex items-center justify-between font-mono text-xs tracking-[0.2em] uppercase text-muted-foreground">
            <span>© 2026 Jonathan Duclos</span>
            <span>Feito com Three.js e Estudo!</span>
          </footer>
        </section>
      </main>
    </div>
  );
}
