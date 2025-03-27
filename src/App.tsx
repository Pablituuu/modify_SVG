import React, { useEffect, useState } from "react";
import parse from "html-react-parser";
import { SHAPES } from "./shapes";

function expandHexColor(color: string): string {
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    return (
      "#" + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]
    );
  }
  return color;
}

function isInsideMask(el: Element): boolean {
  let parent = el.parentElement;
  while (parent) {
    if (parent.tagName.toLowerCase() === "mask") {
      return true;
    }
    parent = parent.parentElement;
  }
  return false;
}

function getEffectiveFill(el: Element): string | null {
  const fillAttr = el.getAttribute("fill");
  if (fillAttr && fillAttr.trim() !== "" && fillAttr.trim() !== "none") {
    return fillAttr.trim();
  }
  const styleAttr = el.getAttribute("style");
  if (styleAttr) {
    const match = /fill\s*:\s*([^;]+);?/.exec(styleAttr);
    if (match) {
      const value = match[1].trim();
      if (value !== "" && value !== "none") {
        return value;
      }
    }
  }
  const parent = el.parentElement;
  if (parent) {
    return getEffectiveFill(parent);
  }
  return null;
}

function convertSvgColorsToHex(svgString: string): string {
  const hexColorRegex = /#([0-9a-fA-F]{3,6})\b/g;
  const rgbColorRegex = /rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/g;
  const rgbaColorRegex = /rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\s*\)/g;

  function expandShortHex(hex: string): string {
    if (hex.length === 3) {
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toUpperCase();
    }
    return `#${hex.toUpperCase()}`;
  }

  function rgbToHex(r: number, g: number, b: number): string {
    return `#${((1 << 24) | (r << 16) | (g << 8) | b)
      .toString(16)
      .slice(1)
      .toUpperCase()}`;
  }

  svgString = svgString.replace(hexColorRegex, (_, hex) => expandShortHex(hex));
  svgString = svgString.replace(rgbColorRegex, (_, r, g, b) =>
    rgbToHex(+r, +g, +b)
  );
  svgString = svgString.replace(rgbaColorRegex, (_, r, g, b) =>
    rgbToHex(+r, +g, +b)
  );

  return svgString;
}

const parseCssStyles = (
  cssText: string
): Record<string, { fill?: string; stroke?: string }> => {
  const validateCssText = `.${cssText
    .split(".")
    .filter((t) => t.includes("fill:"))
    .join(".")}`;
  const styles: Record<string, { fill?: string; stroke?: string }> = {};
  const regex = /\.([\w-]+)\s*\{\s*([^}]+)\s*\}/g;
  let match;
  while ((match = regex.exec(validateCssText)) !== null) {
    const className = match[1];
    const properties = match[2];
    const styleObj: { fill?: string; stroke?: string } = {};
    const fillMatch = /fill\s*:\s*([^;]+);?/.exec(properties);
    const strokeMatch = /stroke\s*:\s*([^;]+);?/.exec(properties);
    if (fillMatch) {
      styleObj.fill = expandHexColor(fillMatch[1].trim());
    }
    if (strokeMatch) {
      styleObj.stroke = expandHexColor(strokeMatch[1].trim());
    }
    styles[className] = styleObj;
  }
  return styles;
};

function isValidHexColor(hex: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex);
}

function prefixSvgClasses(svgCode: string, prefix: string) {
  const colors: string[] = [];
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgCode, "image/svg+xml");

  const styleElements = svgDoc.querySelectorAll("style");
  const classStyles: Record<string, { fill?: string; stroke?: string }> = {};

  styleElements.forEach((styleEl) => {
    const originalCss = styleEl.textContent || "";
    const parsedStyles = parseCssStyles(originalCss);
    Object.assign(classStyles, parsedStyles);

    const prefixedCss = originalCss
      .replace(/\.(st[\w-]+)/g, `.${prefix}-$1`)
      .replace(/url\(#(.*?)\)/g, `url(#${prefix}-$1)`);
    styleEl.textContent = prefixedCss;

    const elements = Array.from(svgDoc.querySelectorAll("*"));
    const colorSet = new Set<string>();
    elements.forEach((el) => {
      if (isInsideMask(el)) return;
      ["fill", "stroke", "stop-color"].forEach((attr) => {
        const color = el.getAttribute(attr);
        if (color && !["none", "transparent"].includes(color)) {
          colorSet.add(expandHexColor(color));
        }
      });
      const inlineStyle = el.getAttribute("style");
      if (inlineStyle) {
        const fillMatch = /fill\s*:\s*([^;]+);?/.exec(inlineStyle);
        const strokeMatch = /stroke\s*:\s*([^;]+);?/.exec(inlineStyle);
        const stopColorMatch = /stop-color\s*:\s*([^;]+);?/.exec(inlineStyle);
        if (fillMatch) {
          const color = fillMatch[1].trim();
          if (color && !["none", "transparent"].includes(color)) {
            isValidHexColor(expandHexColor(color)) &&
              colorSet.add(expandHexColor(color));
          }
        }
        if (strokeMatch) {
          const color = strokeMatch[1].trim();
          if (color && !["none", "transparent"].includes(color)) {
            isValidHexColor(expandHexColor(color)) &&
              colorSet.add(expandHexColor(color));
          }
        }
        if (stopColorMatch) {
          const color = stopColorMatch[1].trim();
          if (color && !["none", "transparent"].includes(color)) {
            isValidHexColor(expandHexColor(color)) &&
              colorSet.add(expandHexColor(color));
          }
        }
      }
      const classAttr = el.getAttribute("class");
      if (classAttr) {
        classAttr.split(" ").forEach((cls) => {
          const styleForClass = classStyles[cls];
          if (
            styleForClass?.fill &&
            !["none", "transparent"].includes(styleForClass.fill)
          ) {
            colorSet.add(expandHexColor(styleForClass.fill));
          }
          if (
            styleForClass?.stroke &&
            !["none", "transparent"].includes(styleForClass.stroke)
          ) {
            colorSet.add(expandHexColor(styleForClass.stroke));
          }
        });
      }
    });
    Array.from(colorSet).forEach((color) => {
      isValidHexColor(color) && colors.push(color);
    });
  });

  const elements = Array.from(svgDoc.querySelectorAll("*"));
  const colorSet = new Set<string>();
  elements.forEach((el) => {
    if (isInsideMask(el)) return;
    const classAttr = el.getAttribute("class");
    if (classAttr) {
      const newClass = classAttr
        .split(" ")
        .map((cls) => `${prefix}-${cls}`)
        .join(" ");
      el.setAttribute("class", newClass);
      newClass.split(" ").forEach((cls) => {
        const styleForClass = classStyles[cls];
        if (
          styleForClass?.fill &&
          !["none", "transparent"].includes(styleForClass.fill)
        ) {
          colorSet.add(expandHexColor(styleForClass.fill));
        }
        if (
          styleForClass?.stroke &&
          !["none", "transparent"].includes(styleForClass.stroke)
        ) {
          colorSet.add(expandHexColor(styleForClass.stroke));
        }
      });
    }
    ["fill", "stroke", "stop-color"].forEach((attr) => {
      const color = el.getAttribute(attr);
      if (color && !["none", "transparent"].includes(color)) {
        colorSet.add(expandHexColor(color));
      }
    });

    const inlineStyle = el.getAttribute("style");
    if (inlineStyle) {
      const fillMatch = /fill\s*:\s*([^;]+);?/.exec(inlineStyle);
      const strokeMatch = /stroke\s*:\s*([^;]+);?/.exec(inlineStyle);
      const stopColorMatch = /stop-color\s*:\s*([^;]+);?/.exec(inlineStyle);
      if (fillMatch) {
        const color = fillMatch[1].trim();
        if (color && !["none", "transparent"].includes(color)) {
          colorSet.add(expandHexColor(color));
        }
      }
      if (strokeMatch) {
        const color = strokeMatch[1].trim();
        if (color && !["none", "transparent"].includes(color)) {
          colorSet.add(expandHexColor(color));
        }
      }
      if (stopColorMatch) {
        const color = stopColorMatch[1].trim();
        if (color && !["none", "transparent"].includes(color)) {
          colorSet.add(expandHexColor(color));
        }
      }
    }
  });

  colorSet.forEach(
    (c) => !colors.includes(c) && isValidHexColor(c) && colors.push(c)
  );

  const allElements = Array.from(svgDoc.querySelectorAll("*"));
  allElements.forEach((el) => {
    if (el.hasAttribute("id")) {
      const oldId = el.getAttribute("id");
      el.setAttribute("id", `${prefix}-${oldId}`);
    }
    ["fill", "stroke", "stop-color", "filter", "clip-path", "mask"].forEach(
      (attr) => {
        const value = el.getAttribute(attr);
        if (value && value.includes("url(#")) {
          el.setAttribute(
            attr,
            value.replace(/url\(#(.*?)\)/g, `url(#${prefix}-$1)`)
          );
        }
      }
    );
    if (el.hasAttribute("style")) {
      const styleAttr = el.getAttribute("style")!;
      if (styleAttr.includes("url(#")) {
        el.setAttribute(
          "style",
          styleAttr.replace(/url\(#(.*?)\)/g, `url(#${prefix}-$1)`)
        );
      }
    }
  });

  const pathElements = Array.from(svgDoc.querySelectorAll("path"));
  pathElements.forEach((el) => {
    if (isInsideMask(el)) return;
    const effectiveFill = getEffectiveFill(el);
    if (!effectiveFill && !el.getAttribute("class")) {
      el.setAttribute("fill", "#000000");
      if (!colors.includes("#000000")) {
        colors.push("#000000");
      }
    }
  });

  const serializer = new XMLSerializer();
  return { serializer: serializer.serializeToString(svgDoc), colors };
}

function transformarString(
  input: string,
  reemplazos: { [key: string]: string }
): string {
  let resultado = input;
  // Recorremos cada clave en el objeto de reemplazos
  for (const clave in reemplazos) {
    if (Object.prototype.hasOwnProperty.call(reemplazos, clave)) {
      // Usamos expresión regular global para reemplazar todas las ocurrencias
      const regex = new RegExp(clave, "g");
      resultado = resultado.replace(regex, reemplazos[clave]);
    }
  }
  return resultado;
}

interface ColorableSvgProps {
  url: string;
  prefix: string;
  name: string;
}

const ColorableSvg: React.FC<ColorableSvgProps> = ({ url, prefix, name }) => {
  const [svgContent, setSvgContent] = useState<string>("");
  const [defaultSvgContent, setDefaultSvgContent] = useState<string>("");
  const [colorMapping, setColorMapping] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchSvg = async () => {
      try {
        const response = await fetch(url);
        const text = await response.text();
        const { serializer, colors } = prefixSvgClasses(
          convertSvgColorsToHex(text),
          prefix
        );
        const mapping: Record<string, string> = {};
        colors.forEach((color) => {
          mapping[color] = color;
        });
        setColorMapping(mapping);
        setSvgContent(serializer);
        setDefaultSvgContent(serializer);
      } catch (error) {
        console.error("Error al cargar el SVG:", error);
      }
    };
    fetchSvg();
  }, [url, prefix]);

  const changeColor = (color: string, index: number) => {
    const initialColor = Object.keys(colorMapping)[index];
    const newColorMapping = { ...colorMapping, [initialColor]: color };
    setColorMapping(newColorMapping);
    const newSvgContent = transformarString(defaultSvgContent, newColorMapping);
    setSvgContent(newSvgContent);
  };

  return (
    <div style={{ border: "1px solid #ccc", padding: "10px" }}>
      <div>{name}</div>
      <div>{svgContent ? parse(svgContent) : <p>Cargando SVG...</p>}</div>
      <div style={{ marginTop: "20px" }}>
        <h4>Modificar Colores:</h4>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {Object.values(colorMapping).map((color, index) => (
            <div key={index} style={{ textAlign: "center" }}>
              <div
                style={{
                  backgroundColor: color,
                  width: 50,
                  height: 50,
                  border: "1px solid #000",
                  marginBottom: "5px",
                }}
              />
              <div style={{ fontSize: "0.75rem" }}>{color}</div>
              <input
                type="color"
                onChange={(e) => changeColor(e.target.value, index)}
                value={color}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const MultipleSvgsExample: React.FC = () => {
  return (
    <div
      style={{
        display: "flex",
        gap: "20px",
        padding: "20px",
      }}
    >
      {SHAPES.map((shape) => (
        <div key={shape.id} style={{ width: "300px" }}>
          <ColorableSvg name={shape.id} url={shape.preview} prefix={shape.id} />
        </div>
      ))}
    </div>
  );
};

export default MultipleSvgsExample;
