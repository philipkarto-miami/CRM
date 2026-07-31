import { signIn } from "./actions";
import { Input, Label } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <p className="font-serif text-3xl text-paper">Philip Karto</p>
          <p className="eyebrow mt-2">Atelier CRM</p>
        </div>

        <form action={signIn} className="card space-y-4 rounded-sm p-6">
          <div>
            <Label>Email</Label>
            <Input type="email" name="email" required placeholder="prenom@philipkarto.com" />
          </div>
          <div>
            <Label>Mot de passe</Label>
            <Input type="password" name="password" required />
          </div>

          {searchParams?.error && (
            <p className="text-sm text-red-400">
              Identifiants invalides. Verifie ton email et ton mot de passe.
            </p>
          )}

          <Button type="submit" className="w-full">
            Se connecter
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-paper/40">
          Acces reserve aux membres de l&apos;atelier. Pour obtenir un compte, contacte
          l&apos;administrateur.
        </p>
      </div>
    </div>
  );
}
