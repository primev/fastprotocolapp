'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface NavLinkCompatProps
  extends Omit<
    React.AnchorHTMLAttributes<HTMLAnchorElement>,
    'href' | 'className'
  > {
  to: string;
  className?: string;
  activeClassName?: string;
  pendingClassName?: string; // Not used in Next.js; kept for API compatibility
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  (
    { className, activeClassName, pendingClassName: _pending, to, ...props },
    ref
  ) => {
    const pathname = usePathname();
    const isActive = pathname === to;
    return (
      <Link
        href={to}
        ref={ref as any}
        className={cn(className, isActive && activeClassName)}
        {...props}
      />
    );
  }
);

NavLink.displayName = 'NavLink';

export { NavLink };
