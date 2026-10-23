import { createFileRoute } from "@tanstack/react-router";
import { FanArena } from "@/components/fanarena/app";

export const Route = createFileRoute("/")({ component: FanArena });
