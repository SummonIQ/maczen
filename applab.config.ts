export default {
  name: "MacZen",
  description: "AppLab managed project",
  type: "monorepo",
  apps: [
    {
      description: "",
      dev: {
        command: "bun dev"
      },
      name: "desktop-app-tauri",
      path: "apps/desktop-app-tauri",
      type: "desktop-app"
    },
    {
      description: "",
      dev: {
        command: "bun dev",
        port: 30051
      },
      name: "marketing-site",
      path: "apps/marketing-site",
      type: "web-app"
    },
    {
      description: "Adaptive screenshot organizer with modern UI",
      dev: {
        command: "bun dev",
        port: 10124
      },
      name: "desktop-app",
      path: "apps/desktop-app",
      type: "web-app"
    }
  ]
};
