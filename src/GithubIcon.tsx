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

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import { faGithub } from "@fortawesome/free-brands-svg-icons";

interface GithubIconProps {
  repoUrl: string;
}

const GithubIcon: React.FC<GithubIconProps> = ({ repoUrl }) => {
  return (
    <a
      href={repoUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        borderRadius: "9999px",
        transition: "background-color 0.2s",
        cursor: "pointer",
      }}
    >
      <FontAwesomeIcon
        icon={faGithub}
        style={{ width: "30px", height: "30px", color: "#000000" }}
      />
    </a>
  );
};

export default GithubIcon;