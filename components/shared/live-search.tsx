"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type LiveSearchProps = {
  initialValue?: string;
  placeholder: string;
  ariaLabel?: string;
  paramName?: string;
  delay?: number;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
};

export function LiveSearch({
  initialValue = "",
  placeholder,
  ariaLabel,
  paramName = "q",
  delay = 300,
  className,
  inputClassName,
  autoFocus = false,
}: LiveSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const isFirstRender = useRef(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastCommittedValue = useRef(initialValue);

  const commit = useCallback(
    (nextValue: string) => {
      const params = new URLSearchParams(window.location.search);
      const trimmed = nextValue.trim();
      lastCommittedValue.current = trimmed;

      if (trimmed) {
        params.set(paramName, trimmed);
      } else {
        params.delete(paramName);
      }
      params.delete("page");

      const queryString = params.toString();
      startTransition(() => {
        router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
          scroll: false,
        });
      });
    },
    [paramName, pathname, router],
  );

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = window.setTimeout(() => commit(value), delay);
    return () => window.clearTimeout(timer);
  }, [commit, delay, value]);

  useEffect(() => {
    if (initialValue === lastCommittedValue.current) return;

    lastCommittedValue.current = initialValue;
    const timer = window.setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setValue(initialValue);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initialValue]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        name={paramName}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit(value);
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
        className={cn("ps-8", isPending && "pe-8", inputClassName)}
      />
      {isPending && (
        <Loader2
          className="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
          aria-hidden
        />
      )}
    </div>
  );
}
