"use client";

import React, { ReactNode } from "react";
import { VideoClipperProvider } from "./VideoClipperContext";

interface AppProvidersProps {
  children: ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return <VideoClipperProvider>{children}</VideoClipperProvider>;
};
