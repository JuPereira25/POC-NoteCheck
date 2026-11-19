import { useState, useRef, useEffect } from "react";
import styles from "./MenuBar.module.css";

interface MenuItem {
  label: string;
  shortcut?: string;
  onSelect?: () => void;
  divider?: false;
}

interface MenuDivider {
  divider: true;
}

type MenuEntry = MenuItem | MenuDivider;

interface Menu {
  label: string;
  items: MenuEntry[];
}

interface MenubarProps {
  menus?: Menu[];
}

const DEFAULT_MENUS: Menu[] = [
  {
    label: "Arquivo",
    items: [
      { label: "REINICIAR", shortcut: "Ctrl+N" },
      { label: "SAIR", shortcut: "Ctrl+O" },
    ],
  },
  {
    label: "Configuração",
    items: [
      { label: "PREFERÊNCIAS" },
    ],
  },
];

export default function Menubar({ menus = DEFAULT_MENUS }: MenubarProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenIndex(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleTriggerClick(index: number) {
    setOpenIndex((current) => (current === index ? null : index));
  }

  function handleTriggerHover(index: number) {
    if (openIndex !== null) setOpenIndex(index);
  }

  function handleItemClick(item: MenuItem) {
    item.onSelect?.();
    setOpenIndex(null);
  }

  return (
    <div ref={rootRef} className={styles.menubar}>
      {menus.map((menu, index) => (
        <div key={menu.label} className={styles.menuWrapper}>
          <button
            type="button"
            onClick={() => handleTriggerClick(index)}
            onMouseEnter={() => handleTriggerHover(index)}
            className={`${styles.trigger} ${openIndex === index ? styles.triggerActive : ""}`}
          >
            {menu.label}
          </button>

          {openIndex === index && (
            <div className={styles.dropdown}>
              {menu.items.map((item, i) =>
                "divider" in item ? (
                  <div key={i} className={styles.divider} />
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleItemClick(item)}
                    className={styles.item}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && (
                      <span className={styles.shortcut}>{item.shortcut}</span>
                    )}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
