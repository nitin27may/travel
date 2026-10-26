import { Icon } from '@/components/ui/Icon';
import { ACCOUNT_LINKS } from '@/lib/config/product';

/**
 * The phone bar's fifth item (ACCT-PH), a server component: it ships no JS, which is how the bar gains
 * an item inside the trip-page start budget. Both links are rendered; `html[data-signed-in]` (set by
 * AccountNav after its one session read) decides which shows, so there is no second auth call. The bar
 * marks the current one (aria-current) after mount, because only the client knows the path.
 */
export function AccountItems() {
  return (
    <>
      {Object.entries(ACCOUNT_LINKS).map(([k, a]) => (
        <a key={k} href={a.href} data-acct={k}>
          <Icon name="user" size={22} />
          {a.label}
        </a>
      ))}
    </>
  );
}
