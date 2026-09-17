import React, { useId } from "react";
import { websiteLogoSrc } from "./WebsiteLogo";

// Each layer uses the original logo; only the book and leaf regions move.
const layers = [
  [
    "leaf-left",
    "M479 748 C451 654 382 585 342 507 C306 426 341 316 417 264 C455 239 506 226 559 222 C461 253 394 322 383 418 C367 538 449 608 479 748Z",
  ],
  [
    "leaf-right",
    "M775 748 C803 654 872 585 912 507 C948 426 913 316 837 264 C799 239 748 226 695 222 C793 253 860 322 871 418 C887 538 805 608 775 748Z",
  ],
  [
    "book-left",
    "M218 774 C347 725 520 726 627 849 L627 916 C506 844 368 863 248 916 L281 848 C257 831 234 809 218 774Z",
  ],
  [
    "book-right",
    "M627 849 C734 726 907 725 1036 774 C1020 809 997 831 973 848 L1006 916 C886 863 748 844 627 916Z",
  ],
];

export default function AnimatedLoginLogo({ phase }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      className={`animated-login-logo animated-login-logo-${phase}`}
      viewBox="0 0 1280 1280"
      role="img"
      aria-label="Logo Rawuh Pustaka"
    >
      <defs>
        <mask
          id={`${id}-base`}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="1280"
          height="1280"
          style={{ maskType: "luminance" }}
        >
          <rect width="1280" height="1280" fill="white" />
          {layers.map(([name, d]) => (
            <path key={name} d={d} fill="black" />
          ))}
        </mask>
        {layers.map(([name, d]) => (
          <clipPath
            key={name}
            id={`${id}-${name}`}
            clipPathUnits="userSpaceOnUse"
          >
            <path d={d} />
          </clipPath>
        ))}
      </defs>
      <image
        href={websiteLogoSrc}
        width="1280"
        height="1280"
        mask={`url(#${id}-base)`}
      />
      {layers.map(([name]) => (
        <g key={name} className={`animated-login-${name}`}>
          <image
            href={websiteLogoSrc}
            width="1280"
            height="1280"
            clipPath={`url(#${id}-${name})`}
          />
        </g>
      ))}
      {phase === "success" && (
        <>
          <g
            className="animated-login-page-light"
            fill="none"
            stroke="#fff0b1"
            strokeWidth="9"
            strokeLinecap="round"
          >
            <path
              d="M620 851 C523 773 390 757 272 793"
              pathLength="1"
              clipPath={`url(#${id}-book-left)`}
            />
            <path
              d="M634 851 C731 773 864 757 982 793"
              pathLength="1"
              clipPath={`url(#${id}-book-right)`}
            />
          </g>
          {[
            [244, 223],
            [1032, 364],
            [167, 652],
            [1090, 779],
          ].map(([x, y], index) => (
            <g
              key={index}
              transform={`translate(${x} ${y})`}
              className="animated-login-sparkle"
            >
              <path
                d="M0 -23 Q4 -4 23 0 Q4 4 0 23 Q-4 4 -23 0 Q-4 -4 0 -23Z"
                fill="#c4942e"
                style={{ "--spark-delay": `${320 + index * 140}ms` }}
              />
            </g>
          ))}
        </>
      )}
    </svg>
  );
}
