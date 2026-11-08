import type { NavIcon } from "@/lib/navigation";

export type SearchGroupKey = Extract<
  NavIcon,
  | "employees"
  | "departments"
  | "positions"
  | "leave"
  | "payroll"
  | "requests"
  | "assets"
  | "users"
  | "recruitment"
  | "training"
>;

export type SearchResult = {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

export type SearchGroup = {
  key: SearchGroupKey;
  results: SearchResult[];
};

export type SearchResponse = {
  groups: SearchGroup[];
};
