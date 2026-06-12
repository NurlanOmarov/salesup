import { logoutAction } from "@/app/(auth)/logout-action";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button variant="outline" size="sm" type="submit">
        Выйти
      </Button>
    </form>
  );
}
