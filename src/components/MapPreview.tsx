/**
 * Copyright 2024 SmallVillageProject
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  MAP_LABELS,
  MAP_PREVIEW_IMAGES,
  MAPS,
  MapKind,
} from "../lib/mapKind";

interface MapPreviewProps {
  mapKind: MapKind;
  onChange: (mapKind: MapKind) => void;
}

const mapKinds = Object.values(MAPS) as MapKind[];

const arrowClass =
  "absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-stone-700 ring-1 ring-stone-900/10 transition hover:bg-white active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 focus-visible:ring-offset-1";

const MapPreview: React.FC<MapPreviewProps> = ({ mapKind, onChange }) => {
  const currentIndex = mapKinds.indexOf(mapKind);

  const selectRelativeMap = (offset: number) => {
    const nextIndex = (currentIndex + offset + mapKinds.length) % mapKinds.length;
    onChange(mapKinds[nextIndex]);
  };

  return (
    <div className="w-full">
      <div className="relative h-[220px] w-full overflow-hidden rounded-xl bg-stone-800 ring-1 ring-white/15">
        <img
          key={mapKind}
          src={MAP_PREVIEW_IMAGES[mapKind]}
          alt={`${MAP_LABELS[mapKind]} map preview`}
          className="h-full w-full object-cover [image-rendering:pixelated]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-stone-950/90 to-transparent px-14 pb-2 pt-8 text-center">
          <p className="text-sm font-bold text-white sv-pixel-shadow">
            {MAP_LABELS[mapKind]}
          </p>
          <p className="mt-0.5 text-[11px] tabular-nums text-white/70">
            {currentIndex + 1}/{mapKinds.length}
          </p>
        </div>
        <button
          type="button"
          aria-label="Previous map"
          className={`left-2 ${arrowClass}`}
          onClick={() => selectRelativeMap(-1)}
        >
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          aria-label="Next map"
          className={`right-2 ${arrowClass}`}
          onClick={() => selectRelativeMap(1)}
        >
          <ChevronRight size={20} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};

export default MapPreview;
