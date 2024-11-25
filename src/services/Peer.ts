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

import EventListener from "../utils/EventListener";
import JobQueue from "../utils/JobQueue";
import {
  RenegotiationResponse,
  TrackObject,
  TracksResponse,
} from "../utils/callsTypes";

const baseUrl = "https://rtc.live.cloudflare.com/v1/apps";
const appId = process.env.REACT_APP_CLOUDFLARE_APP_ID;
const appSecret = process.env.REACT_APP_CLOUDFLARE_APP_SECRET;

interface PeerMid {
  mid: string | null;
}

export interface PeerTrack {
  trackName: string | null | undefined;
  sessionId: string;
  mid?: string | null;
}

export interface PeerStream {
  sessionId?: string;
  kind: string;
  stream: MediaStream;
}

export default class Peer extends EventListener {
  private _peerConnection?: RTCPeerConnection;
  private _sessionId?: string;
  private _remoteTracks: Map<string, TrackObject[]> = new Map();
  private _jobQueue = new JobQueue();
  private _streams: PeerStream[] = [];

  // getter sessionId
  get sessionId() {
    return this._sessionId;
  }

  // getter peerConnection
  get peerConnection() {
    return this._peerConnection;
  }

  createPeerConnection = async (): Promise<RTCPeerConnection> => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
      ],
      bundlePolicy: "max-bundle",
    });

    this._peerConnection = peerConnection;

    return peerConnection;
  };

  createSession = async (): Promise<string> => {
    const baseUrl = "https://rtc.live.cloudflare.com/v1/apps";
    const appId = process.env.REACT_APP_CLOUDFLARE_APP_ID;
    const appSecret = process.env.REACT_APP_CLOUDFLARE_APP_SECRET;

    const url = `${baseUrl}/${appId}/sessions/new`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${appSecret}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      this._sessionId = data.sessionId;

      if (!this._sessionId) {
        throw new Error("Session ID not found");
      }

      return this._sessionId;
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  addLocalTracks = async (audioTrack: MediaStreamTrack) => {
    if (!this._peerConnection) {
      throw new Error("Peer Connection not found");
    }

    const pc = this._peerConnection;

    if (pc.signalingState === "closed") {
      return;
    }

    pc?.addTransceiver(audioTrack, {
      direction: "sendonly",
    });
  };

  replaceTrack = async (track: MediaStreamTrack) => {
    if (!this._peerConnection) {
      throw new Error("Peer Connection not found");
    }

    const pc = this._peerConnection;
    if (pc.signalingState === "closed") {
      return;
    }

    const sender = pc.getSenders().find((s) => s.track?.kind === track.kind);
    if (!sender) {
      throw new Error("Sender not found");
    }

    sender.replaceTrack(track);
  };

  private _pushLocalTracks = async (): Promise<PeerTrack[]> => {
    if (!this._sessionId) {
      throw new Error("Session ID not found");
    }

    const pc = this._peerConnection;
    if (!pc) {
      throw new Error("Peer Connection not found");
    }

    const offer = await pc.createOffer();
    if (!offer) {
      throw new Error("Local Description not found");
    }

    await pc.setLocalDescription(offer);

    const pushTracks = pc
      .getTransceivers()
      .map(({ mid, sender }) => {
        if (sender && sender.track?.kind === "audio") {
          // set network priority
          const params: RTCRtpSendParameters = sender.getParameters();
          params.encodings[0].networkPriority = "high";
          sender.setParameters(params);

          return {
            location: "local",
            mid,
            trackName: sender?.track?.id,
          };
        }
        return null;
      })
      .filter((track) => track !== null);

    const url = `${baseUrl}/${appId}/sessions/${this._sessionId}/tracks/new`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionDescription: {
          sdp: offer.sdp,
          type: offer.type,
        },
        tracks: pushTracks,
      }),
    });

    const data: TracksResponse = await response.json();
    if (!data.tracks) {
      throw new Error("Tracks not found");
    }

    const error = data.tracks.filter((track) => track.errorCode);
    if (error && error.length > 0) {
      throw new Error(error[0].errorDescription);
    }

    if (data.sessionDescription) {
      this._peerConnection?.setRemoteDescription(data.sessionDescription);
    }

    const peerTracks: PeerTrack[] = data.tracks.map((track) => {
      const peerTrack: PeerTrack = {
        sessionId: this._sessionId as string,
        trackName: track.trackName,
      };
      return peerTrack;
    });

    return peerTracks;
  };

  private _pullRemoteTracks = async (
    sessionId: string,
    remoteTracks: PeerTrack[]
  ): Promise<TracksResponse> => {
    const url = `${baseUrl}/${appId}/sessions/${this._sessionId}/tracks/new`;
    const pullTracks = remoteTracks.map((track) => {
      return {
        location: "remote",
        sessionId: track.sessionId,
        trackName: track.trackName,
      };
    });
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tracks: pullTracks }),
    });

    const data: TracksResponse = await response.json();

    const error = data.tracks?.filter((track) => track.errorCode);
    if (error && error.length > 0) {
      throw new Error(error[0].errorDescription);
    }

    data.tracks?.forEach(
      ({ mid, sessionId }: { mid?: string | null; sessionId?: string }) => {
        const handleTrack = (event: RTCTrackEvent) => {
          if (event.transceiver.mid !== mid) {
            return;
          }

          const peerStream: PeerStream = {
            sessionId,
            stream: event.streams[0],
            kind: event.track.kind,
          };
          this._streams.push(peerStream);

          this.fireEvent("track", peerStream);
          this._peerConnection?.removeEventListener("track", handleTrack);
        };

        this._peerConnection?.addEventListener("track", handleTrack);
      }
    );

    if (data.tracks) {
      this._remoteTracks.set(sessionId, data.tracks);
    }

    return data;
  };

  private _renegotiation = async (
    desc: RTCSessionDescriptionInit
  ): Promise<RenegotiationResponse> => {
    // set remote description
    this._peerConnection?.setRemoteDescription(desc);

    // create answer
    const answer = await this._peerConnection?.createAnswer();
    if (!answer) {
      throw new Error("Answer not found");
    }

    // set local description
    await this._peerConnection?.setLocalDescription(answer);

    const url = `${baseUrl}/${appId}/sessions/${this._sessionId}/renegotiate`;
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${appSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionDescription: {
          sdp: answer.sdp,
          type: answer.type,
        },
      }),
    });

    const data: RenegotiationResponse = await response.json();
    return data;
  };

  private _closeTracks = async (sessionId: string): Promise<void> => {
    const tracks: TrackObject[] = this._remoteTracks.get(sessionId) || [];
    if (tracks.length === 0) {
      console.log("No tracks found", sessionId);
      return;
    }
    this._remoteTracks.delete(sessionId);

    this._streams
      .filter((stream) => stream.sessionId === sessionId)
      .forEach((stream) => {
        this.fireEvent("removeTrack", stream);
      });

    // remove stream in streams
    this._streams = this._streams.filter(
      (stream) => stream.sessionId !== sessionId
    );

    // remote track from peer connection
    const pc = this._peerConnection;
    if (!pc) {
      throw new Error("Peer Connection not found");
    }

    const mids: PeerMid[] = [];
    tracks.forEach((track) => {
      const transceiver = pc
        .getTransceivers()
        .filter((transceiver) => transceiver.mid === track.mid);

      transceiver.forEach((transceiver) => {
        mids.push({ mid: transceiver.mid });
        transceiver.direction = "inactive";
      });
    });

    // create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const url = `${baseUrl}/${appId}/sessions/${this._sessionId}/tracks/close`;
    const response: Response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${appSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionDescription: {
          sdp: offer.sdp,
          type: offer.type,
        },
        tracks: mids,
        force: false,
      }),
    });

    const data = await response.json();

    const answer = data.sessionDescription;
    if (answer) {
      pc.setRemoteDescription(answer);
    }
  };

  pushLocalTracks = async () => {
    return this._jobQueue.addJob(async () => await this._pushLocalTracks());
  };

  pullRemoteTracks = async (
    sessionId: string,
    remoteTracks: PeerTrack[]
  ): Promise<void> => {
    return this._jobQueue.addJob(async () => {
      // find if the remote tracks are already added
      if (this._remoteTracks.has(sessionId)) {
        console.log("Remote Tracks already added", sessionId);
        return;
      }

      const response: TracksResponse = await this._pullRemoteTracks(
        sessionId,
        remoteTracks
      );

      if (response.requiresImmediateRenegotiation) {
        const desc: RTCSessionDescriptionInit = {
          sdp: response.sessionDescription.sdp,
          type: response.sessionDescription.type,
        };
        await this._renegotiation(desc);
      }
    });
  };

  closeTracks = async (sessionId: string): Promise<void> => {
    return this._jobQueue.addJob(
      async () => await this._closeTracks(sessionId)
    );
  };

  close = async () => {
    this._remoteTracks.clear();
    this._streams = [];
    this._peerConnection?.close();
  };
}
