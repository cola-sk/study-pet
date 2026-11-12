# KidLearn Parent H5 Design System

## Direction

The parent app is a calm family management space with a warm, polished feel. Keep the interface clear and restrained; express its child-friendly character through the pet, paw-print mark, reward details, and occasional celebratory motion. Avoid turning every control into a bright, playful element.

The visual foundation is warm ivory, soft white, forest green, and muted terracotta. Surfaces use fine warm borders and low, diffuse shadows. Layouts are mobile-first and information-dense enough for daily family tasks while keeping clear section hierarchy.

## Brand mark and iconography

- Use a simple paw print as the KidLearn brand mark.
- Keep the existing white paw silhouette on a red background for the app tile; use the red circular mark in the website header.
- Keep the paw silhouette centered and inside the safe area so it remains legible when an operating system masks the icon into a circle or squircle.
- In the small website roundel, let the paw occupy roughly half to three-fifths of the circle; on the home-screen tile, let it use about 70% of the safe area.
- Use the same artwork for the browser favicon, Apple touch icon, PWA icons, home-screen shortcuts, and install guide.
- Keep the master artwork in `apps/parent-h5/public/icons/paw-app-icon.svg`; regenerate its PNG and ICO derivatives when the mark changes.
- Use line icons for navigation and actions. Pet emoji or illustrations belong in child and pet identity areas, not as general-purpose controls.

## Color palette

| Token | Value | Use |
| --- | --- | --- |
| Canvas | `#F5F4F0` | Main page background |
| Surface | `#FFFFFF` | Cards, lists, inputs |
| Ink | `#242620` | Primary text |
| Muted ink | `#77786F` | Supporting text |
| Line | `#E9E7E0` | Dividers and subtle borders |
| Forest | `#3E493F` | Selected filters and install action |
| Brand red (`--app-brand-red`) | `#EF4444` | Existing paw-print identity in the header and app icon |
| Terracotta | `#B96043` | Primary action, selected navigation, pending emphasis |
| Terracotta soft | `#F7EBE5` | Pending and selected states |
| Reward gold | `#A87525` | Coins and reward values |
| Reward gold soft | `#FBF3E2` | Reward and retry backgrounds |
| Success sage | `#4C7866` | Online and completed states |
| Success soft | `#E9F2EC` | Success and online backgrounds |

Use terracotta for the main action and one or two high-priority cues. Reserve gold for rewards and sage for positive states. Use neutral gray-green for progress, inactive, and secondary information. Avoid adding another saturated accent without a clear meaning.

These values are exposed as `--app-*` custom properties in `apps/parent-h5/src/app/globals.css`.

## Typography

- Chinese UI: system sans-serif such as PingFang SC, Hiragino Sans GB, or Microsoft YaHei.
- Latin UI: Nunito for friendly, readable body and interface text. Use Fredoka sparingly for short expressive labels. Use Roboto Mono only when aligned numeric values benefit from it.
- Keep the hierarchy compact and consistent: page title 17px, section title 16px, card title 14–15px, body 12–13px, secondary metadata 10–11px.
- Use 10–11px text only for tertiary details such as timestamps, device labels, and counts. Primary task names and actions should remain at least 12px.
- Prefer medium and bold weights for hierarchy. Do not use decorative type for long text.

## Spacing and layout

Use a 4px base unit, with 8px as the normal component gap.

- Mobile page gutters: 16px.
- Card padding: 12px, with 14–16px for featured or summary cards.
- Related rows and controls: 8–10px apart.
- Section spacing: 16px; use 20px only between distinct content groups.
- Compact task rows: about 52px minimum height, with enough vertical space for a second metadata line.
- Keep the bottom navigation fixed and account for the device safe area and navigation height in page padding.
- Allow long filters and labels to scroll or truncate gracefully on narrow screens.

## Shape and elevation

- Cards and lists: 14–16px corners.
- Main action buttons: 9–10px corners; compact controls may use 8px.
- Filter and count chips: fully rounded pills.
- Pet avatars: 14px corners; app mark: 11px corners.
- Use fine 1px borders and restrained shadows. Cards should lift gently from the canvas without hard outlines, chunky offsets, or large dark shadows.
- Keep fixed headers and navigation lightly tinted and translucent, with a subtle divider or shadow.

## Components

### Navigation and header

- Use a forest-green app mark with a warm-white paw print.
- Keep the header compact, with the app name and a short family-context label. Show family and device counts in a quiet outlined chip.
- Use a warm white bottom bar. The active item uses terracotta and a soft tinted icon background; inactive items stay muted.

### Buttons

- **Primary:** terracotta fill with white text; use for the main decision or submission action.
- **Secondary:** white fill, warm neutral border, muted ink text.
- **Success:** sage fill for a clear positive confirmation when a primary action is not more appropriate.
- **Destructive:** quiet red text and border; keep it visually secondary until confirmation is needed.
- Use compact 32–34px controls in dense mobile rows and at least 40px for standalone prominent actions where space allows. Current approval actions and filters use the compact size; keep adequate spacing between adjacent targets.
- Use a subtle 1px pressed movement and restrained hover changes. Respect `prefers-reduced-motion`.

### Cards and lists

- Summary cards use white surfaces, warm borders, 14–16px corners, and very soft shadows.
- Pending approval cards use an ivory surface and a subtle warm border. Make the task title and reward easy to scan; keep child and device labels quiet.
- Keep task lists white with warm dividers and compact rows. Use status chips to communicate state without coloring the entire row.

### Filters and status

- Default filter: warm gray fill with muted text.
- Selected filter: forest-green fill with warm-white text.
- Count badges: muted gold with dark text.
- Completed or online: soft sage.
- Pending or selected: soft terracotta.
- In progress or offline: neutral gray-green.
- Rewards and retry reminders: soft gold.

### Install surfaces

- The install banner uses an oatmeal background, subdued icon tile, concise benefit copy, and a forest-green action.
- The iOS install guide and home-screen assets reuse the same paw-print identity as the browser and PWA icons.

## Motion and feedback

- Use short transitions for color, shadow, and pressed states; avoid bounce on routine controls.
- Use the existing reward confetti only for successful reward moments, with muted terracotta, gold, sage, and cream tones.
- Keep success, retry, and offline feedback clear and encouraging.

## Accessibility and content

- Maintain readable contrast for primary and supporting text.
- Provide visible keyboard focus and semantic labels for icon-only controls.
- Keep tap targets separated; enlarge the hit area when compact visual controls are used.
- Use short, supportive Chinese copy. Explain status in words as well as color.
- Keep family information and child identity within the parent-controlled experience.

## Do and avoid

- Do use warm neutrals to establish a calm surface and reserve strong color for actions and meaningful state.
- Do keep pets and rewards as the source of playfulness.
- Do keep card, chip, button, and status styles consistent across tabs.
- Avoid mixing several bright status colors in one viewport.
- Avoid tiny text for task names, actions, or essential instructions.
- Avoid thick borders, heavy shadows, overly large corner radii, and decorative color blocks that compete with task content.
