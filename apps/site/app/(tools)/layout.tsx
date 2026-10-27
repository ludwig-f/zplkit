import { HomeLayout } from "fumadocs-ui/layouts/home";
import { baseOptions } from "@/lib/layout.shared";
import { ToolHeader } from "@/components/site-header";

/**
 * The playground and the viewer: a shorter header, so the editor and the
 * label get the height. The tools read --fd-header-height for theirs.
 */
export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <HomeLayout
      {...baseOptions()}
      slots={{ header: ToolHeader }}
      className="[--fd-header-height:48px] md:[--fd-header-height:44px]"
    >
      {children}
    </HomeLayout>
  );
}
