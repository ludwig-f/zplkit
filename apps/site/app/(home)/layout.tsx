import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/lib/layout.shared";
import { SiteHeader } from "@/components/site-header";

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <HomeLayout {...baseOptions()} slots={{ header: SiteHeader }}>
      {children}
    </HomeLayout>
  );
}
