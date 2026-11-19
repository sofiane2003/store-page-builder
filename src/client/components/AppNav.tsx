import { Link, useRouterState } from "@tanstack/react-router";

const LINKS = [
  { to: "/", label: "Pages" },
  { to: "/products", label: "Products" },
  { to: "/quizzes", label: "Quizzes" },
  { to: "/library", label: "Library" },
  { to: "/brand", label: "Brand" },
] as const;

/** The app's sections, in the AppShell bar. */
export function AppNav() {
  const admin = useRouterState({
    select: (state) => {
      const root = state.matches[0]?.loaderData;
      return Boolean(root && "admin" in root && root.admin);
    },
  });
  const links = admin ? [...LINKS, { to: "/published", label: "Published" } as const] : LINKS;
  return (
    <nav className="flex min-w-0 items-center gap-3 overflow-x-auto text-sm">
      {links.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          activeOptions={{ exact: link.to === "/" }}
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground data-[status=active]:font-medium data-[status=active]:text-foreground"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
