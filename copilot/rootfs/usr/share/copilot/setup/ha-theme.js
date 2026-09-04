"use strict";

const themeProperties = [
  ["--app-primary-color", "--primary-color", "#03a9f4"],
  ["--app-primary-contrast-color", "--text-primary-color", "#ffffff"],
  ["--app-primary-background-color", "--primary-background-color", "#fafafa"],
  ["--app-secondary-background-color", "--secondary-background-color", "#e5e5e5"],
  ["--app-card-background-color", "--card-background-color", "#ffffff"],
  ["--app-header-background-color", "--app-header-background-color", "#ffffff"],
  ["--app-header-text-color", "--app-header-text-color", "#212121"],
  ["--app-primary-text-color", "--primary-text-color", "#212121"],
  ["--app-secondary-text-color", "--secondary-text-color", "#727272"],
  ["--app-disabled-text-color", "--disabled-text-color", "#bdbdbd"],
  ["--app-divider-color", "--divider-color", "rgba(0, 0, 0, 0.12)"],
  ["--app-error-color", "--error-color", "#db4437"],
  ["--app-success-color", "--success-color", "#43a047"],
  ["--app-warning-color", "--warning-color", "#ffa600"],
  ["--app-radius-sm", "--ha-border-radius-sm", "4px"],
  ["--app-radius-md", "--ha-border-radius-md", "8px"],
  ["--app-radius-lg", "--ha-border-radius-lg", "12px"],
  ["--app-space-2", "--ha-space-2", "8px"],
  ["--app-space-3", "--ha-space-3", "12px"],
  ["--app-space-4", "--ha-space-4", "16px"],
  ["--app-font-size-s", "--ha-font-size-s", "12px"],
  ["--app-font-size-m", "--ha-font-size-m", "14px"],
  ["--app-font-size-l", "--ha-font-size-l", "16px"],
  ["--app-font-size-xl", "--ha-font-size-xl", "20px"],
];

function resolveColor(value) {
  const probe = document.createElement("span");
  probe.style.color = value;
  probe.hidden = true;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

function isDarkColor(value) {
  const channels = resolveColor(value).match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!channels || channels.length !== 3) {
    return false;
  }

  const luminance = channels.reduce(
    (total, channel, index) =>
      total + channel * [0.2126, 0.7152, 0.0722][index],
    0,
  );
  return luminance < 128;
}

function syncHomeAssistantTheme() {
  let parentDocument;

  try {
    parentDocument = window.parent.document;
  } catch {
    return;
  }

  const source = getComputedStyle(parentDocument.documentElement);
  const target = document.documentElement.style;

  for (const [targetName, sourceName, fallback] of themeProperties) {
    target.setProperty(
      targetName,
      source.getPropertyValue(sourceName).trim() || fallback,
    );
  }

  const bodyStyle = getComputedStyle(parentDocument.body);
  target.setProperty(
    "--app-font-family",
    source.getPropertyValue("--ha-font-family-body").trim() ||
    bodyStyle.fontFamily ||
    "Roboto, Noto, sans-serif",
  );

  const background =
    source.getPropertyValue("--primary-background-color").trim() || "#fafafa";
  target.colorScheme = isDarkColor(background) ? "dark" : "light";
}

syncHomeAssistantTheme();

try {
  const parentDocument = window.parent.document;
  const observer = new MutationObserver(syncHomeAssistantTheme);
  const elements = [
    parentDocument.documentElement,
    parentDocument.body,
    parentDocument.querySelector("home-assistant"),
  ].filter(Boolean);

  for (const element of elements) {
    observer.observe(element, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
  }

  window.addEventListener("focus", syncHomeAssistantTheme);
  document.addEventListener("visibilitychange", syncHomeAssistantTheme);
} catch {
  // Standalone fallback values remain active when no parent theme is available.
}