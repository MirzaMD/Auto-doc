"use client";
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import * as THREE from "three";

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleLogin = () => {
    window.location.href = "https://auto-doc-latest.onrender.com/auth/github";
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    // ── Scene & Camera ────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 5);

    // ── Lights ────────────────────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x8b5cf6, 6, 20);
    pointLight1.position.set(-4, 3, 3);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x06b6d4, 6, 20);
    pointLight2.position.set(4, -3, 3);
    scene.add(pointLight2);

    const pointLight3 = new THREE.PointLight(0xf472b6, 3, 20);
    pointLight3.position.set(0, 4, -2);
    scene.add(pointLight3);

    // ── Central torus-knot ────────────────────────────────────────────────────
    const knotGeo = new THREE.TorusKnotGeometry(1.25, 0.34, 220, 32, 2, 3);
    const knotMat = new THREE.MeshPhysicalMaterial({
      color: 0x1a1a2e,
      metalness: 0.9,
      roughness: 0.08,
      reflectivity: 1,
      iridescence: 1,
      iridescenceIOR: 1.8,
      iridescenceThicknessRange: [100, 800],
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 2,
    });
    const knotMesh = new THREE.Mesh(knotGeo, knotMat);
    scene.add(knotMesh);

    // ── Floating icosahedra particles ─────────────────────────────────────────
    const icoGeo = new THREE.IcosahedronGeometry(0.08, 0);
    const icoMat = new THREE.MeshPhysicalMaterial({
      color: 0x8b5cf6,
      metalness: 1,
      roughness: 0.1,
      emissive: 0x4c1d95,
      emissiveIntensity: 0.6,
    });

    const particles: THREE.Mesh[] = [];
    const particleData: { phi: number; theta: number; radius: number; speed: number; offset: number }[] = [];
    const PARTICLE_COUNT = 55;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const mesh = new THREE.Mesh(icoGeo, icoMat.clone());
      const phi   = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const r     = 2.4 + Math.random() * 1.8;
      mesh.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      const s = 0.5 + Math.random() * 1.4;
      mesh.scale.setScalar(s);
      scene.add(mesh);
      particles.push(mesh);
      particleData.push({ phi, theta, radius: r, speed: 0.12 + Math.random() * 0.22, offset: Math.random() * Math.PI * 2 });
    }

    // ── Grid / wireframe plane ────────────────────────────────────────────────
    const gridHelper = new THREE.GridHelper(24, 28, 0x8b5cf620, 0x8b5cf615);
    gridHelper.position.y = -3.2;
    gridHelper.rotation.x = 0.18;
    scene.add(gridHelper);

    // ── Subtle star-field ─────────────────────────────────────────────────────
    const starCount = 600;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) starPositions[i] = (Math.random() - 0.5) * 40;
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.035, transparent: true, opacity: 0.55 });
    scene.add(new THREE.Points(starGeo, starMat));

    // ── Mouse parallax ────────────────────────────────────────────────────────
    const mouse = { x: 0, y: 0 };
    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth  - 0.5) * 2;
      mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", handleMouseMove);

    // ── Resize ────────────────────────────────────────────────────────────────
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    // ── Animation loop ────────────────────────────────────────────────────────
    let frameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      knotMesh.rotation.x = t * 0.18;
      knotMesh.rotation.y = t * 0.26;
      const breathe = 1 + 0.04 * Math.sin(t * 1.2);
      knotMesh.scale.setScalar(breathe);

      pointLight1.position.x = Math.sin(t * 0.5) * 5;
      pointLight1.position.y = Math.cos(t * 0.4) * 4;
      pointLight2.position.x = Math.cos(t * 0.45) * 5;
      pointLight2.position.y = Math.sin(t * 0.35) * 4;

      particles.forEach((p, i) => {
        const d = particleData[i];
        const angle = t * d.speed + d.offset;
        p.position.x = d.radius * Math.sin(d.phi) * Math.cos(d.theta + angle);
        p.position.y = d.radius * Math.sin(d.phi) * Math.sin(d.theta + angle);
        p.position.z = d.radius * Math.cos(d.phi) + Math.sin(t * d.speed * 0.7 + d.offset) * 0.3;
        p.rotation.x += 0.01 * d.speed;
        p.rotation.y += 0.015 * d.speed;
      });

      camera.position.x += (mouse.x * 0.6 - camera.position.x) * 0.04;
      camera.position.y += (-mouse.y * 0.4 - camera.position.y) * 0.04;
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#05050f]">

      {/* Three.js canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Radial vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, transparent 30%, #05050f 90%)" }}
      />

      {/* UI layer */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">

        {/* Top wordmark */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-12 text-center"
        >
          <span className="text-[10px] tracking-[0.35em] uppercase text-violet-400/70 font-mono block mb-1">
            powered by ai
          </span>
          <h1
            className="text-6xl font-black text-white"
            style={{ fontFamily: "'Syne', sans-serif", letterSpacing: "-0.03em" }}
          >
            Auto
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: "linear-gradient(90deg, #a78bfa, #22d3ee)" }}
            >
              Doc
            </span>
          </h1>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          className="relative w-full max-w-95"
        >
          {/* Glow ring */}
          <div
            className="absolute -inset-px rounded-2xl blur-md"
            style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.4), rgba(6,182,212,0.2), rgba(244,114,182,0.3))" }}
          />

          {/* Card body */}
          <div
            className="relative rounded-2xl overflow-hidden border border-white/10"
            style={{
              background: "linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
              backdropFilter: "blur(24px)",
            }}
          >
            {/* Top shimmer */}
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(167,139,250,0.6), transparent)" }}
            />

            <div className="px-9 py-10 text-center">

              {/* Icon badge */}
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.35, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="mx-auto mb-6 w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #7c3aed, #0891b2)" }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 2v6h6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 13l1.5 1.5L14 11" stroke="#a5f3fc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-white/90 text-base font-semibold mb-1"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                AI-powered PR analysis
              </motion.p>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.48 }}
                className="text-white/40 text-xs tracking-wide mb-8"
              >
                Automated documentation for your team
              </motion.p>

              {/* GitHub button */}
              <motion.button
                onClick={handleLogin}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.56 }}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="group relative w-full py-3.5 rounded-xl font-semibold text-sm overflow-hidden cursor-pointer"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                <span
                  className="absolute inset-0 rounded-xl"
                  style={{
                    background: "linear-gradient(120deg, #7c3aed, #0891b2, #7c3aed)",
                    backgroundSize: "200% 100%",
                    animation: "gradientSlide 3s linear infinite",
                  }}
                />
                <span
                  className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                />
                <span
                  className="absolute bottom-0 left-4 right-4 h-px rounded-full"
                  style={{ background: "rgba(255,255,255,0.3)" }}
                />

                <span className="relative z-10 flex items-center justify-center gap-2.5 text-white">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
                  </svg>
                  Continue with GitHub
                </span>
              </motion.button>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="mt-6 text-[11px] text-white/25 leading-relaxed"
              >
                By continuing, you agree to our Terms of Service
                <br />and Privacy Policy.
              </motion.p>
            </div>

            {/* Bottom shimmer */}
            <div
              className="absolute bottom-0 left-0 right-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(34,211,238,0.4), transparent)" }}
            />
          </div>
        </motion.div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800;900&display=swap');

        @keyframes gradientSlide {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>
    </div>
  );
}