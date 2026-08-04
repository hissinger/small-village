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

import { MapKind } from "../lib/mapKind";
import MapPreview from "./MapPreview";

interface ChooseYourMapProps {
  mapKind: MapKind;
  onChange: (mapKind: MapKind) => void;
}

const ChooseYourMap: React.FC<ChooseYourMapProps> = ({ mapKind, onChange }) => (
  <div className="flex h-full flex-col">
    <div className="mb-4 flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-orange-700 text-xs text-white sv-font-pixel">
        2
      </span>
      <h2 className="text-sm font-bold uppercase tracking-wider text-stone-100">
        Choose a Map
      </h2>
    </div>

    <MapPreview mapKind={mapKind} onChange={onChange} />
  </div>
);

export default ChooseYourMap;
