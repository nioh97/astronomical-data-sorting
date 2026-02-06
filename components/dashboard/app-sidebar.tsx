"use client"

import * as React from "react"
import {
  Home,
  Upload,
  Database,
  BarChart3,
  Brain,
  Settings,
  LogOut,
  ChevronUp,
  Telescope,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuth } from "@/lib/auth-context"

// Navigation items
const navigationItems = [
  {
    id: "home",
    title: "Home",
    icon: Home,
    description: "Platform overview",
  },
  {
    id: "upload",
    title: "Upload Data",
    icon: Upload,
    description: "CSV, FITS, JSON ingestion",
  },
  {
    id: "repository",
    title: "Repository",
    icon: Database,
    description: "Unified data tables",
  },
  {
    id: "visualization",
    title: "Visualization",
    icon: BarChart3,
    description: "Charts and analysis",
  },
  {
    id: "ai-discovery",
    title: "AI Discovery",
    icon: Brain,
    description: "Statistical insights",
  },
  {
    id: "university-observatory",
    title: "University Observatory",
    icon: Telescope,
    description: "Institution live telemetry feed",
  },
]

interface AppSidebarProps {
  activeSection: string
  onSectionChange: (section: string) => void
}

export function AppSidebar({ activeSection, onSectionChange }: AppSidebarProps) {
  const { user, logout } = useAuth()
  
  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <div className="flex items-center gap-2 cursor-default">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Telescope className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">SKYSCRIBE</span>
                  <span className="truncate text-xs text-muted-foreground">Data Fusion</span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={activeSection === item.id}
                    onClick={() => onSectionChange(item.id)}
                    tooltip={item.description}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                      {user?.username?.slice(0, 2).toUpperCase() || "RA"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {user?.username || "Researcher"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      Research Analyst
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="top"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem disabled>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      
      <SidebarRail />
    </Sidebar>
  )
}
