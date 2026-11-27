import { redirect } from "next/navigation";

// Une seule vue d'ensemble : le kanban de l'Atelier (/production). On ouvre
// ensuite un sac pour arriver sur ses etapes.
export default function AtelierHome() {
  redirect("/production");
}
