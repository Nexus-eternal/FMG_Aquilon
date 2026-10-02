export const ROUTE_ENVIRONMENTS = {
  surface: "Surface road / sea lane",
  air: "Air route",
  underwater: "Underwater route",
  underground: "Underground tunnel"
} as const;

export type RouteEnvironment = keyof typeof ROUTE_ENVIRONMENTS;
export interface RouteEndpoint {
  realm: string;
  burg: number;
}

export function getRouteEnvironment(route: { environment?: RouteEnvironment; depth?: number }): RouteEnvironment {
  return route.environment ?? (route.depth === undefined ? "surface" : "underwater");
}
