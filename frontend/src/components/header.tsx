import { Terminal } from "lucide-react";
import React from "react";
import { ThemeToggle } from "./ui/theme-toggle";
import Link from "next/link";

const Header = () => {
  return (
    <div className="px-6 py-3 border-b border-foreground bg-background">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xl">
          <Terminal className="h-6 w-6 text-foreground animate-bounce" />
          <span>cliply.exe</span>
        </div>
        <div className="flex items-center gap-x-2">
          <Link
            href={"https://x.com/decocereus"}
            target="_blank"
            className="hover:underline"
          >
            <p className="text-sm text-muted-foreground">@decocereus</p>
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
};

export default Header;
