import React, { useEffect, useState } from "react";
import parse from "html-react-parser";
import { SHAPES } from "./shapes";

const parseCssStyles = (
  cssText: string
): Record<string, { fill?: string; stroke?: string }> => {
  const styles: Record<string, { fill?: string; stroke?: string }> = {};
  const regex = /\.([\w-]+)\s*\{\s*([^}]+)\s*\}/g;
  let match;
  while ((match = regex.exec(cssText)) !== null) {
    const className = match[1];
    const properties = match[2];
    const styleObj: { fill?: string; stroke?: string } = {};
    const fillMatch = /fill\s*:\s*([^;]+);?/.exec(properties);
    const strokeMatch = /stroke\s*:\s*([^;]+);?/.exec(properties);
    if (fillMatch) {
      styleObj.fill = fillMatch[1].trim();
    }
    if (strokeMatch) {
      styleObj.stroke = strokeMatch[1].trim();
    }
    styles[className] = styleObj;
  }
  return styles;
};

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

    const elements = Array.from(svgDoc.querySelectorAll("*"));
    const colorSet = new Set<string>();

    elements.forEach((el) => {
      let colorFound = false;

      ["fill", "stroke", "stop-color"].forEach((attr) => {
        const color = el.getAttribute(attr);
        if (color && !["none", "transparent"].includes(color)) {
          colorSet.add(color);
          colorFound = true;
        }
      });

      const inlineStyle = el.getAttribute("style");
      if (inlineStyle) {
        const fillMatch = /fill\s*:\s*([^;]+);?/.exec(inlineStyle);
        const strokeMatch = /stroke\s*:\s*([^;]+);?/.exec(inlineStyle);
        if (fillMatch) {
          const color = fillMatch[1].trim();
          if (color && !["none", "transparent"].includes(color)) {
            colorSet.add(color);
            colorFound = true;
          }
        }
        if (strokeMatch) {
          const color = strokeMatch[1].trim();
          if (color && !["none", "transparent"].includes(color)) {
            colorSet.add(color);
            colorFound = true;
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
            colorSet.add(styleForClass.fill);
            colorFound = true;
          }
          if (
            styleForClass?.stroke &&
            !["none", "transparent"].includes(styleForClass.stroke)
          ) {
            colorSet.add(styleForClass.stroke);
            colorFound = true;
          }
        });
      }

      if (el.tagName.toLowerCase() === "path" && !colorFound) {
        colorSet.add("#000000");
      }
    });

    Array.from(colorSet).forEach((color) => {
      colors.push(color);
    });

    const prefixedCss = originalCss.replace(/\.(st[\w-]+)/g, `.${prefix}-$1`);
    styleEl.textContent = prefixedCss;
  });

  const allElements = svgDoc.querySelectorAll("*");
  allElements.forEach((el) => {
    const classAttr = el.getAttribute("class");
    if (classAttr) {
      const newClass = classAttr
        .split(" ")
        .map((cls) => `${prefix}-${cls}`)
        .join(" ");
      el.setAttribute("class", newClass);
    }
  });

  const serializer = new XMLSerializer();
  return { serializer: serializer.serializeToString(svgDoc), colors };
}

interface ColorableSvgProps {
  url: string;
  prefix: string;
}

function changeColor(
  svgCode: string,
  oldColor: string,
  newColor: string
): string {
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgCode, "image/svg+xml");

  svgDoc.querySelectorAll("style").forEach((styleEl) => {
    let cssText = styleEl.textContent || "";
    cssText = cssText.replace(oldColor, newColor);
    styleEl.textContent = cssText;
  });

  const serializer = new XMLSerializer();
  return serializer.serializeToString(svgDoc);
}

const ColorableSvg: React.FC<ColorableSvgProps> = ({ url, prefix }) => {
  const [svgContent, setSvgContent] = useState<string>("");
  const [colors, setColors] = useState<string[]>([]);
  const [colorMapping, setColorMapping] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchSvg = async () => {
      try {
        const response = await fetch(url);
        const text = await response.text();
        const { serializer, colors } = prefixSvgClasses(text, prefix);
        let colorMapping: Record<string, string> = {};
        colors.forEach((color) => {
          colorMapping[color] = color;
        });
        setColorMapping(colorMapping);
        setSvgContent(serializer);
        setColors(colors);
      } catch (error) {
        console.error("Error al cargar el SVG:", error);
      }
    };
    fetchSvg();
  }, []);

  const handleConvert = (oldColor: string, newColor: string, index: number) => {
    const color = Object.keys(colorMapping)[index];
    const updatedMapping = { ...colorMapping, [color]: newColor };
    setColors(Object.values(updatedMapping));
    setColorMapping(updatedMapping);
    const updatedSvg = changeColor(svgContent, oldColor, newColor);
    setSvgContent(updatedSvg);
  };

  return (
    <div style={{ border: "1px solid #ccc", padding: "10px" }}>
      <div>{svgContent ? parse(svgContent) : <p>Cargando SVG...</p>}</div>
      <div style={{ marginTop: "20px" }}>
        <h4>Modificar Colores:</h4>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {colors.map((color, index) => (
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
              <input
                onChange={(e) => handleConvert(color, e.target.value, index)}
                type="color"
                value={color}
              />
              <div style={{ fontSize: "0.75rem" }}>{color}</div>
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
        <div style={{ width: "300px" }}>
          <ColorableSvg url={shape.preview} prefix={shape.id} />
        </div>
      ))}
    </div>
  );
};

export default MultipleSvgsExample;
