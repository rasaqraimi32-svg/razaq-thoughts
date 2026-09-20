"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import Arrow from "./Arrow";

const links = [{ href: "/", label: "Home" }, { href: "/articles", label: "Articles" }, { href: "/about", label: "About Me" }, { href: "/contact", label: "Contact" }];

export default function Header() {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const open = openPath === pathname;

  return (
    <header className="site-header" onKeyDown={(event) => {
      if (event.key === "Escape" && open) { setOpenPath(null); menuButton.current?.focus(); }
    }}>
      <div className="container header-inner">
        <Link href="/" className="brand" onClick={() => setOpenPath(null)} aria-label="Razaq Thoughts home"><span className="brand-mark" aria-hidden="true">RT</span><span>Razaq Thoughts<span className="brand-caption">ARTICLES, THOUGHTS & REFLECTIONS</span></span></Link>
        <button ref={menuButton} className="menu-toggle" type="button" aria-expanded={open} aria-controls="primary-navigation" onClick={() => setOpenPath(open ? null : pathname)}>{open ? "Close" : "Menu"}<span aria-hidden="true">{open ? "×" : "☰"}</span></button>
        <nav id="primary-navigation" className={"primary-nav" + (open ? " is-open" : "")} aria-label="Main navigation">
          {links.map(({ href, label }) => <Link key={href} href={href} aria-current={(href === "/" ? pathname === href : pathname.startsWith(href)) ? "page" : undefined} onClick={() => setOpenPath(null)}>{label}</Link>)}
          <Link className="button button-small" href="/articles" onClick={() => setOpenPath(null)}>Explore Articles <Arrow /></Link>
        </nav>
      </div>
    </header>
  );
}
