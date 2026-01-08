'use client'

import type { BetterAuthUser } from '@/shared/auth/server'
import { ChevronsUpDown } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Button } from '../ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { LogoutButton } from './logout-button'

interface Props {
  user?: BetterAuthUser
}

export function UserButton({ user }: Props) {
  const fallbackInitials = user?.name?.split(' ').map(name => name.charAt(0)).join('').toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="w-full flex items-center gap-2 h-fit py-4"
          variant="ghost"
        >
          <Avatar className="h-10 w-10 rounded-lg bg-foreground/20">
            <AvatarImage src={user?.image || undefined} alt={user?.name} />
            <AvatarFallback className="rounded-lg bg-foreground/20 p-2">
              {fallbackInitials}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{user?.name ?? 'user'}</span>
            <span className="truncate text-xs">{user?.email ?? '_@gmail.com'}</span>
          </div>
          <ChevronsUpDown className="ml-auto size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
        side="bottom"
        align="end"
        sideOffset={4}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage src={user?.image || undefined} alt={user?.name} />
              <AvatarFallback className="rounded-lg">
                {fallbackInitials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user?.name ?? 'user'}</span>
              <span className="truncate text-xs">{user?.email ?? '_@gmail.com'}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="p-0 cursor-pointer">
          <LogoutButton />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
