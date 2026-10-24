"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowUpRight } from "lucide-react";

const navLinks = [
  { href: "/parlamentares", label: "POLÍTICOS" },
  { href: "/pautas", label: "VOTAÇÕES" },
  { href: "/emendas", label: "EMENDAS" },
  { href: "/mapa", label: "MAPA" },
  { href: "/sobre", label: "MANIFESTO" },
];

export function Navbar() {
  const pathname = usePathname();
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <header className="collage-nav ruido-nav relative z-30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[76px] items-center justify-between gap-4 py-3">
          <Link href="/" className="ruido-nav-logo group inline-flex min-w-0 items-center gap-3" aria-label="RUÍDO — início">
            <span className="collage-brand flex h-12 w-12 shrink-0 items-center justify-center border-[3px] border-punk-acid bg-ink">
              <img
                src="/assets/skull-xerox.svg"
                alt=""
                aria-hidden="true"
                className="collage-mascot h-10 w-10"
                width="40"
                height="40"
              />
            </span>
            <span className="font-heavy text-4xl leading-none tracking-wide text-paper sm:text-5xl">RUÍDO</span>
            <span className="ruido-nav-edition hidden font-mono text-[10px] font-bold uppercase tracking-widest lg:inline-block">
              DADOS PÚBLICOS / SEM FILTRO
            </span>
          </Link>

          <nav className="hidden items-center gap-1.5 md:flex" aria-label="Navegação principal">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={["ruido-nav-link", "ruido-nav-brush", link.href === "/sobre" ? "ruido-nav-manifesto" : "", isActive ? "is-active" : ""].join(" ")}
                >
                  <span className="ruido-nav-label">{link.label}</span>
                  {link.href === "/sobre" && <ArrowUpRight className="ruido-nav-icon" size={14} strokeWidth={3} aria-hidden="true" />}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            className="ruido-nav-toggle inline-flex items-center gap-2 md:hidden"
            aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuAberto}
            aria-controls="ruido-menu-mobile"
            onClick={() => setMenuAberto((aberto) => !aberto)}
          >
            {menuAberto ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
            <span>{menuAberto ? "FECHAR" : "MENU"}</span>
          </button>
        </div>

        <nav
          id="ruido-menu-mobile"
          className={["ruido-mobile-menu pb-4 md:hidden", menuAberto ? "is-open" : "hidden"].join(" ")}
          aria-label="Navegação móvel"
        >
          {navLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={["ruido-nav-link", "ruido-nav-brush", link.href === "/sobre" ? "ruido-nav-manifesto" : "", isActive ? "is-active" : ""].join(" ")}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setMenuAberto(false)}
              >
                <span className="ruido-nav-label">{link.label}</span>
                <ArrowUpRight className="ruido-nav-icon" size={16} strokeWidth={3} aria-hidden="true" />
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
