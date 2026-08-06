import { useEffect, useMemo, useRef, useState } from "react";
import { vscodeApi, WebviewMessage } from "./vscodeApi";
import { iconUri } from "./iconUri";

type Provider = "openai" | "gemini";

interface RootItem {
  id: "model" | "keys";
  section: string;
  label: string;
}

interface SubItem {
  id: Provider;
  label: string;
}

const ROOT_ITEMS: RootItem[] = [
  { id: "model", section: "Model", label: "Switch model..." },
  { id: "keys", section: "API Keys", label: "Manage API keys..." },
];

const SUBMENUS: Record<"model" | "keys", SubItem[]> = {
  model: [
    { id: "openai", label: "OpenAI" },
    { id: "gemini", label: "Gemini" },
  ],
  keys: [
    { id: "openai", label: "OpenAI API Key" },
    { id: "gemini", label: "Gemini API Key" },
  ],
};

type MenuState =
  | { level: "none" }
  | { level: "root"; filter: string }
  | { level: "submenu"; kind: "model" | "keys"; filter: string };

function parseMenu(input: string): MenuState {
  if (!input.startsWith("/")) {
    return { level: "none" };
  }
  const rest = input.slice(1);
  const spaceIndex = rest.indexOf(" ");
  if (spaceIndex === -1) {
    return { level: "root", filter: rest };
  }
  const kind = rest.slice(0, spaceIndex);
  if (kind === "model" || kind === "keys") {
    return { level: "submenu", kind, filter: rest.slice(spaceIndex + 1) };
  }
  return { level: "none" };
}

interface Message {
  role: "user" | "system";
  text: string;
}

export function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const listener = (event: MessageEvent<WebviewMessage>) => {
      if (event.data.type === "system") {
        setMessages((prev) => [
          ...prev,
          { role: "system", text: event.data.text },
        ]);
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);

  const menu = parseMenu(input);

  const rootItems = useMemo(
    () =>
      ROOT_ITEMS.filter((item) =>
        item.label
          .toLowerCase()
          .includes(menu.level === "root" ? menu.filter.toLowerCase() : ""),
      ),
    [menu],
  );
  const subItems = useMemo(
    () =>
      menu.level === "submenu"
        ? SUBMENUS[menu.kind].filter((item) =>
            item.label.toLowerCase().includes(menu.filter.toLowerCase()),
          )
        : [],
    [menu],
  );
  const visibleCount =
    menu.level === "root"
      ? rootItems.length
      : menu.level === "submenu"
        ? subItems.length
        : 0;
  const activeIndex = Math.min(highlighted, Math.max(visibleCount - 1, 0));

  function selectRoot(item: RootItem) {
    setInput(`/${item.id} `);
    setHighlighted(0);
  }

  function selectSub(item: SubItem) {
    if (menu.level !== "submenu") {
      return;
    }
    vscodeApi.postMessage({
      type: "command",
      command: menu.kind,
      value: item.id,
    });
    setInput("");
    setHighlighted(0);
  }

  function toggleSlash() {
    setInput((prev) => (prev.startsWith("/") ? "" : "/"));
    setHighlighted(0);
    inputRef.current?.focus();
  }

  function submitText() {
    const text = input.trim();
    if (!text) {
      return;
    }
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (menu.level === "none") {
      if (e.key === "Enter") {
        submitText();
      }
      return;
    }
    if (e.key === "Escape") {
      setInput("");
      setHighlighted(0);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, visibleCount - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (menu.level === "root") {
        const item = rootItems[activeIndex];
        if (item) {
          selectRoot(item);
        }
      } else {
        const item = subItems[activeIndex];
        if (item) {
          selectSub(item);
        }
      }
    }
  }

  return (
    <div className="app">
      <div className="topbar">
        <img src={iconUri} className="topbar-icon" alt="" />
        <span className="topbar-title">DevPilot</span>
      </div>

      <div className="messages">
        {messages.length === 0 && (
          <div className="empty">
            <img src={iconUri} className="empty-icon" alt="" />
            <div className="tagline">
              Bring your own key. Type / for commands.
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.text}
          </div>
        ))}
      </div>

      <div className="bar">
        {menu.level === "root" && (
          <div className="menu">
            {rootItems.map((item, i) => (
              <div key={item.id}>
                {item.section !== rootItems[i - 1]?.section && (
                  <div className="section">{item.section}</div>
                )}
                <div
                  className={`item ${i === activeIndex ? "active" : ""}`}
                  onMouseEnter={() => setHighlighted(i)}
                  onClick={() => selectRoot(item)}
                >
                  {item.label}
                </div>
              </div>
            ))}
            {rootItems.length === 0 && (
              <div className="empty-menu">No matches</div>
            )}
          </div>
        )}

        {menu.level === "submenu" && (
          <div className="menu">
            {subItems.map((item, i) => (
              <div
                key={item.id}
                className={`item ${i === activeIndex ? "active" : ""}`}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => selectSub(item)}
              >
                {item.label}
              </div>
            ))}
            {subItems.length === 0 && (
              <div className="empty-menu">No matches</div>
            )}
          </div>
        )}

        <div className="input-box">
          <input
            ref={inputRef}
            className="input"
            placeholder="Type a message or /command"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setHighlighted(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <div className="toolbar">
            <button
              type="button"
              className="slash-btn"
              onClick={toggleSlash}
              aria-label="Commands"
            >
              /
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
