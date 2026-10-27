import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { Wordmark } from "@/components/wordmark";
import { gitConfig } from "./shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Wordmark className="text-[21px]" />,
    },
    links: [
      { text: "Docs", url: "/docs", active: "nested-url" },
      { text: "Playground", url: "/playground" },
      { text: "Viewer", url: "/viewer" },
      { text: "Releases", url: "/releases" },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
