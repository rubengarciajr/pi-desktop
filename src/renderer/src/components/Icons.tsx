/** Clean line-style SVG icons (emdash-inspired). */

interface IconProps {
  className?: string;
  size?: number;
}

function Svg({ children, className, size = 18 }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0 }}
    >
      {children}
    </svg>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </Svg>
  );
}

export function SessionsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 4h6v6H4z" />
      <path d="M14 4h6v6h-6z" />
      <path d="M4 14h6v6H4z" />
      <path d="M14 14h6v6h-6z" />
    </Svg>
  );
}

export function ModelIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </Svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}

export function ExtensionsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20.5 7.27L12 12l-8.5-4.73L12 2.54l8.5 4.73z" />
      <path d="M12 22l-8.5-4.73V7.27" />
      <path d="M12 22l8.5-4.73V7.27" />
      <path d="M12 12v10" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  );
}

export function PiLogoIcon(props: IconProps) {
  const { size = 28 } = props;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 800 800"
      fill="none"
      className={props.className}
      style={{ flexShrink: 0 }}
    >
      <path
        fill="rgb(var(--color-text-rgb))"
        fillRule="evenodd"
        d="M165.29 165.29 H517.36 V400 H400 V517.36 H282.65 V634.72 H165.29 Z M282.65 282.65 V400 H400 V282.65 Z"
      />
      <path fill="rgb(var(--color-accent-rgb))" d="M517.36 400 H634.72 V634.72 H517.36 Z" />
    </svg>
  );
}

/**
 * Pi Routing icon — the fork/arrows SVG from resources/pi-routing.svg.
 * Uses fill="currentColor" so it adapts to dark/light themes via the parent's
 * text color class (text-accent when active, text-text-faint when inactive).
 */
export function PiRoutingIcon(props: IconProps) {
  const { size = 18 } = props;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="currentColor"
      className={props.className}
      style={{ flexShrink: 0 }}
    >
      <path d="m510.173 180.77-53.6 98.448c-2.83 5.22-8.48 8.261-14.4 7.781-5.92-.49-10.99-4.42-12.94-10.031l-8.26-23.762c-11.1 7.081-25.03 17.511-38.67 31.953-11.97 12.671-29.38 34.843-45 60.255l.13-158.883c18.75-15.231 36.57-26.012 51.31-33.493l-8.82-27.872c-1.83-5.781 0-12.091 4.63-16.001 4.63-3.9 11.15-4.64 16.54-1.86l102.78 52.964c3.59 1.85 6.28 5.06 7.47 8.921 1.18 3.859.76 8.04-1.17 11.58z" />
      <path d="m331.992 111.964h-24.5l-.18 215.958c-18.932-52.992-48.357-101.187-85.38-138.711-5.66-5.77-11.48-11.311-17.44-16.601v-60.645h-24.5c-12.69.42-19.95-16.161-11-25.202l76-82.007c5.63-6.34 16.37-6.34 22 0l76 82.007c8.95 9.03 1.7 25.621-11 25.201z" />
      <path d="m275.125 327.532c-17.107-43.666-41.951-84.044-74.601-117.3-27.871-28.442-55.831-46.314-77.281-57.195l8.82-27.872c4.315-12.211-9.856-24.181-21.17-17.861l-102.772 52.964c-7.358 3.597-10.361 13.396-6.3 20.502l53.591 98.448c5.666 11.3 23.595 9.814 27.34-2.25l8.26-23.762c11.1 7.081 25.02 17.511 38.66 31.953 45.464 48.154 66.719 115.522 73.551 184.015.86 8.751 1.27 17.852 1.27 27.822 0 8.281 6.72 15.001 15 15.001h72.691c8.219.173 15.416-7.236 14.99-15.451-1.899-62.705-12.679-119.56-32.049-169.014z" />
    </svg>
  );
}

/**
 * Tag Team icon — two figures in a relay handoff. Represents the sequential
 * model relay feature: Model A builds, tags Model B who finishes.
 * Uses stroke="currentColor" so it adapts to dark/light themes.
 */
export function TagTeamIcon(props: IconProps) {
  const { size = 18 } = props;
  // Artwork from resources/collaboration.svg, inlined so it inherits the UI
  // color via currentColor (the source SVG is hard-black and would otherwise be
  // invisible on the dark theme). Stroke props live on the root; the paths keep
  // their original translate transforms inside the source's matrix group.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 682.66669 682.66669"
      fill="none"
      stroke="currentColor"
      strokeWidth={30}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeMiterlimit={10}
      className={props.className}
      style={{ flexShrink: 0 }}
    >
      <g transform="matrix(1.3333333,0,0,-1.3333333,0,682.66667)">
        <g transform="translate(256,400.6001)">
          <path d="m 0,0 60.259,60.259 c 11.087,11.087 29.062,11.087 40.149,0 0.005,-0.006 0.012,-0.012 0.018,-0.018 5.323,-5.324 8.315,-12.545 8.315,-20.074 0,-7.53 -2.992,-14.751 -8.315,-20.075 -16.021,-16.02 -35.794,-35.793 -35.794,-35.793 0,0 9.835,9.834 19.726,19.726 5.325,5.324 12.545,8.316 20.076,8.316 7.529,0 14.751,-2.992 20.074,-8.316 0.006,-0.005 0.012,-0.012 0.017,-0.017 5.325,-5.324 8.316,-12.545 8.316,-20.075 0,-7.529 -2.991,-14.75 -8.316,-20.074 C 111.295,-49.372 96.4,-64.267 96.4,-64.267 c 0,0 5.562,5.562 12.059,12.059 5.323,5.324 12.545,8.315 20.074,8.315 7.53,0 14.751,-2.991 20.074,-8.315 0.006,-0.005 0.013,-0.012 0.019,-0.018 5.323,-5.323 8.314,-12.545 8.314,-20.074 0,-7.53 -2.991,-14.751 -8.314,-20.075 -13.23,-13.229 -28.126,-28.125 -28.126,-28.125 0,0 5.563,5.562 12.059,12.059 5.324,5.323 12.545,8.315 20.075,8.315 7.529,0 14.75,-2.992 20.074,-8.315 0.006,-0.006 0.012,-0.012 0.018,-0.018 11.086,-11.087 11.086,-29.062 0,-40.149 -26.713,-26.712 -73.821,-73.82 -101.806,-101.806 -14.548,-14.547 -34.277,-22.719 -54.851,-22.719 h -32.135 l -96.401,-96.4" />
        </g>
        <g transform="translate(91.3252,243.9409)">
          <path d="m 0,0 c 5.324,-5.323 12.545,-8.315 20.075,-8.315 7.529,0 14.75,2.992 20.074,8.315 0.006,0.006 0.012,0.012 0.018,0.018 5.323,5.324 8.315,12.545 8.315,20.074 0,7.53 -2.992,14.751 -8.315,20.075 l -8.051,8.051 c -5.324,5.324 -12.545,8.315 -20.075,8.315 -7.529,0 -14.75,-2.991 -20.074,-8.315 -0.006,-0.006 -0.012,-0.012 -0.018,-0.018 -5.323,-5.324 -8.315,-12.545 -8.315,-20.074 0,-7.53 2.992,-14.751 8.315,-20.075 C -5.39,5.39 -2.661,2.662 0,0 Z" />
        </g>
        <g transform="translate(131.4922,284.1079)">
          <path d="m 0,0 c 5.323,-5.324 12.545,-8.315 20.074,-8.315 7.53,0 14.751,2.991 20.075,8.315 0.005,0.005 0.012,0.012 0.018,0.018 5.323,5.323 8.315,12.545 8.315,20.074 0,7.53 -2.992,14.751 -8.315,20.075 -7.681,7.68 -16.438,16.437 -24.118,24.117 -5.323,5.324 -12.545,8.316 -20.074,8.316 -7.53,0 -14.751,-2.992 -20.075,-8.316 -0.005,-0.005 -0.012,-0.012 -0.018,-0.017 -5.323,-5.324 -8.315,-12.545 -8.315,-20.075 0,-7.529 2.992,-14.751 8.315,-20.074 C -16.437,16.437 -7.681,7.681 0,0 Z" />
        </g>
        <g transform="translate(171.6592,324.2744)">
          <path d="m 0,0 c 11.087,-11.087 29.062,-11.087 40.148,0 0.006,0.006 0.013,0.012 0.018,0.018 11.087,11.086 11.087,29.062 0,40.149 -12.271,12.271 -27.912,27.913 -40.184,40.184 -11.086,11.087 -29.062,11.087 -40.149,0 -0.006,-0.005 -0.012,-0.012 -0.018,-0.018 -11.086,-11.086 -11.086,-29.062 0,-40.148 C -27.913,27.913 -12.272,12.272 0,0 Z" />
        </g>
        <g transform="translate(211.8252,364.4414)">
          <path d="m 0,0 c 5.324,-5.324 12.545,-8.315 20.075,-8.315 7.529,0 14.75,2.991 20.074,8.315 0.006,0.005 0.012,0.012 0.018,0.018 5.323,5.323 8.315,12.545 8.315,20.074 0,7.53 -2.992,14.751 -8.315,20.075 -14.426,14.425 -33.792,33.791 -48.218,48.217 -5.323,5.324 -12.545,8.315 -20.074,8.315 -7.53,0 -14.751,-2.991 -20.074,-8.315 -0.006,-0.006 -0.013,-0.012 -0.019,-0.018 -5.323,-5.323 -8.314,-12.544 -8.314,-20.074 0,-7.53 2.991,-14.751 8.314,-20.075 C -33.792,33.792 -14.425,14.425 0,0 Z" />
        </g>
        <g transform="translate(272.0664,127.4668)">
          <path d="M 0,0 96.4,-96.4" />
        </g>
        <g transform="translate(416.667,239.9331)">
          <path d="M 0,0 80.333,-80.333" />
        </g>
        <g transform="translate(95.333,239.9331)">
          <path d="M 0,0 -80.333,-80.333" />
        </g>
        <g transform="translate(207.7998,448.7998)">
          <path d="M 0,0 64.267,32.133 96.4,0" />
        </g>
      </g>
    </svg>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </Svg>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

export function PackagesIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M16.5 9.4l-9-5.19" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </Svg>
  );
}
