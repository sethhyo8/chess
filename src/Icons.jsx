import React from "react";

export function ResourceIcon({ name, size = 20, className = "", ...props }) {
  return (
    <img
      {...props}
      className={`resource-icon ${className}`}
      src={`/brand/chesscom/${name}.png`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
export const Swords = (props) => <ResourceIcon name="play" {...props} />;
export const GraduationCap = (props) => (
  <ResourceIcon name="learn" {...props} />
);
export const ChartNoAxesCombined = (props) => (
  <ResourceIcon name="best" {...props} />
);
export const Library = (props) => <ResourceIcon name="news" {...props} />;
export const BookOpen = (props) => <ResourceIcon name="book" {...props} />;
export const Star = (props) => <ResourceIcon name="best" {...props} />;
