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

export interface SessionDescription {
  type: "offer" | "answer";
  sdp: string;
}

export interface ErrorResponse {
  errorCode?: string;
  errorDescription?: string;
}

export type NewSessionRequest = {
  sessionDescription: SessionDescription;
};

export interface NewSessionResponse extends ErrorResponse {
  sessionDescription: SessionDescription;
  sessionId: string;
}

export type TrackObject = {
  location?: "local" | "remote";
  trackName?: string;
  sessionId?: string;
  mid?: string | null;
};

export type TracksRequest = {
  tracks: TrackObject[];
  sessionDescription?: SessionDescription;
};

export interface TracksResponse extends ErrorResponse {
  sessionDescription: SessionDescription;
  requiresImmediateRenegotiation: boolean;
  tracks?: (TrackObject & ErrorResponse)[];
}

export type RenegotiateRequest = {
  sessionDescription: SessionDescription;
};

export interface RenegotiationResponse extends ErrorResponse {}

export type CloseTracksRequest = TracksRequest & {
  force: boolean;
};

export interface EmptyResponse extends ErrorResponse {}

export type CallsRequest =
  | NewSessionRequest
  | TracksRequest
  | RenegotiateRequest
  | CloseTracksRequest;
export type CallsResponse = EmptyResponse | TracksResponse;
