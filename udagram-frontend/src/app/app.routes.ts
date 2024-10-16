import { Routes } from "@angular/router";
import { authGuard } from "./core/guards/auth.guard";

export const routes: Routes = [
  {
    path: "",
    redirectTo: "feed",
    pathMatch: "full",
  },
  {
    path: "feed",
    loadComponent: () =>
      import("./features/feed/feed.component").then((m) => m.FeedComponent),
    canActivate: [authGuard],
  },
  {
    path: "explore",
    loadComponent: () =>
      import("./features/explore/explore.component").then(
        (m) => m.ExploreComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: "upload",
    loadComponent: () =>
      import("./features/upload/upload.component").then(
        (m) => m.UploadComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: "profile",
    loadComponent: () =>
      import("./features/profile/profile.component").then(
        (m) => m.ProfileComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: "profile/:username",
    loadComponent: () =>
      import("./features/profile/profile.component").then(
        (m) => m.ProfileComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: "post/:id",
    loadComponent: () =>
      import("./features/post-detail/post-detail.component").then(
        (m) => m.PostDetailComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: "notifications",
    loadComponent: () =>
      import("./features/notifications/notifications.component").then(
        (m) => m.NotificationsComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: "activity",
    redirectTo: "notifications",
  },
  {
    path: "login",
    loadComponent: () =>
      import("./features/auth/login/login.component").then(
        (m) => m.LoginComponent
      ),
  },
  {
    path: "register",
    loadComponent: () =>
      import("./features/auth/register/register.component").then(
        (m) => m.RegisterComponent
      ),
  },
  {
    path: "**",
    redirectTo: "feed",
  },
];
