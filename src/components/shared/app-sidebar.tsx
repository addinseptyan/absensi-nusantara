"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronsUpDown, LogOut, UserRound } from "lucide-react";
import { logout } from "@/app/login/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail, useSidebar,
} from "@/components/ui/sidebar";

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

export function AppSidebar({ items, user }: { items: { href: string; label: string; icon: React.ReactNode }[]; user: { name: string; username: string | null; roles: string[] } }) {
  const path = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-1 py-1.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-teal-700 text-white"><Check className="size-4" strokeWidth={3} /></span>
          <div className="grid leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">Absensi Nusantara</span><span className="text-xs text-muted-foreground">SMKS Nusantara Banyuwangi</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup><SidebarGroupContent><SidebarMenu>
          {items.map((i) => (
            <SidebarMenuItem key={i.href}>
              <SidebarMenuButton isActive={path.startsWith(i.href)} tooltip={i.label} render={<Link href={i.href} onClick={() => setOpenMobile(false)} />}>
                {i.icon}<span>{i.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>))}
        </SidebarMenu></SidebarGroupContent></SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu><SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger render={<SidebarMenuButton size="lg" tooltip={user.name} className="data-[popup-open]:bg-sidebar-accent" />}>
              <Avatar className="size-8 rounded-lg"><AvatarFallback className="rounded-lg bg-teal-100 text-teal-800">{initials(user.name)}</AvatarFallback></Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight"><span className="truncate font-medium">{user.name}</span><span className="truncate text-xs text-muted-foreground">{user.roles.join(", ") || "Tanpa role"}</span></div>
              <ChevronsUpDown className="ml-auto size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side={isMobile ? "bottom" : "right"} align="end" className="min-w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal"><p className="truncate font-medium">{user.name}</p>{user.username && <p className="truncate text-xs text-muted-foreground">@{user.username}</p>}</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/akun" onClick={() => setOpenMobile(false)} />}><UserRound />Akun saya</DropdownMenuItem>
              <form action={logout}>
                <DropdownMenuItem variant="destructive" closeOnClick={false} className="w-full" render={<button type="submit" />}><LogOut />Keluar</DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem></SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
