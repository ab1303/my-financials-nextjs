import * as React from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="box-border">
      <div className="flex flex-col">{children}</div>
    </div>
  );
}
