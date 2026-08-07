"use client";

import { Button } from "@/components/ui/Button";

type ButtonProps = React.ComponentProps<typeof Button>;

// Bouton de soumission qui demande une confirmation nommant l'objet avant de
// laisser partir le formulaire (suite a l'audit UX : les suppressions
// partaient jusqu'ici en un seul clic, sans filet).
export function ConfirmSubmitButton({
  confirmMessage,
  children,
  variant = "danger",
  ...props
}: ButtonProps & { confirmMessage: string }) {
  return (
    <Button
      type="submit"
      variant={variant}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
      {...props}
    >
      {children}
    </Button>
  );
}
