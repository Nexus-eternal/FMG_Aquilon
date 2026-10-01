import { pointer } from "d3";
import { closeDialogs, refreshEditors } from "@/components/dialog/dialog-helpers";
import { Layers } from "@/components/layers";
import { stopMapPlacement, toggleMapPlacement } from "@/components/map-placement";
import { tip } from "@/components/tooltips";
import { getPlacementDepth, validateBurgCell } from "@/components/underwater-native";
import { Controllers } from "@/controllers";
import { redrawEmblem } from "@/renderers/draw-emblems";

function toggle(): void {
  if (isActive()) {
    stop();
    return;
  }

  closeDialogs(".stable");
  toggleMapPlacement(
    "addBurgTool",
    addOnClick,
    "Click on the map to create a new burg. Hold Shift to add multiple",
    "warn",
    unpressProxyButton
  );
  document.getElementById("addNewBurg")?.classList.add("pressed");

  Layers.show("burgIcons", "labels");
}

function addOnClick(event: MouseEvent): void {
  const point = pointer(event, event.currentTarget as SVGGElement);
  const cell = Pack.findCell(point[0], point[1]);
  if (cell === undefined) return;

  const depth = getPlacementDepth();
  try {
    validateBurgCell(pack, cell, depth);
  } catch (error) {
    tip((error as Error).message, false, "error");
    return;
  }

  const burgId = Burgs.add(point, { depth });
  redrawEmblem("burg", burgId);
  refreshEditors();
  Layers.draw("burgIcons", "labels", "routes");

  if (!event.shiftKey) {
    stop();
    if (depth !== undefined) void Controllers.BurgEditor.open(burgId);
  }
}

function stop(): void {
  if (isActive()) stopMapPlacement();
  else unpressProxyButton();
}

function isActive(): boolean {
  return document.getElementById("addBurgTool")?.classList.contains("pressed") ?? false;
}

function unpressProxyButton(): void {
  document.getElementById("addNewBurg")?.classList.remove("pressed");
}

export const BurgCreator = { toggle, stop };
