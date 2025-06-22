import { Terminal } from "lucide-react";
import React from "react";

const Header = () => {
  return (
    <div className="p-6 border-b border-foreground  bg-background">
      <div className="flex items-center gap-2 text-xl">
        <Terminal className="h-6 w-6" />
        <span>video_clipper.exe</span>
      </div>
    </div>
  );
};

export default Header;
