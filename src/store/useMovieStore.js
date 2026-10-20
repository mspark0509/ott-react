import { create } from "zustand";

//TMDB키를 변수로 저장하기
const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY;
const YOUTUBE_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

export const useMovieStore = create((set, get) => ({
    // ############ 영화 (인기)
    //인기영화를 저장할 배열
    popMovies: [],
    //인기영화를 불러올 메서드
    onFetchPopular: async () => {
        const res = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&language=ko-KR&page=1`)
        // console.log(res);
        const data = await res.json();
        // console.log(data);
        set({ popMovies: data.results })
    },
    // 영화의 비디오를 저장할 변수
    popVideo: {},
    // 영화의 비디오를 불러오은 메서드 
    onFetchVideo: async (id) => {
        //기존에 불러온 영상이 있는지를 체크해서 있으면 그만 불러와야지??
        const { popVideo } = get();

        if (popVideo[id]) return;

        const res = await fetch(`https://api.themoviedb.org/3/movie/${id}/videos?api_key=${TMDB_KEY}&language=ko-KR`)
        // console.log("비디오", res)
        const data = await res.json();
        // console.log("비디오 데이터", data)
        set((state) => ({
            popVideo: {
                ...state.popVideo,
                [id]: data.results
            }
        }))
    },

    // ############# 티비 (인기)

    // 인기 TV 목록
    tvs: [],
    // TV 영상 저장
    tvVideo: {},
    // 인기 TV 불러오기
    onFetchTv: async () => {
        const res = await fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_KEY}&language=ko-KR&page=1`);

        if (!res.ok) throw new Error("TV 목록을 불러오지 못했습니다.");
        const data = await res.json();
        //?? 왼쪽값이 null, undefined 이면 오른쪽을 사용해라
        //? 왼쪽값이 존재하면 체이닝을 실행해라
        set({ tvs: data.results ?? [] });
    },

    // TV 영상 가져오기
    onFetchTvVideo: async (id) => {
        const { tvVideo } = get();
        if (tvVideo[id]) return;
        const res = await fetch(`https://api.themoviedb.org/3/tv/${id}/videos?api_key=${TMDB_KEY}&language=en-US`);

        if (!res.ok) throw new Error("TV 영상을 불러오지 못했습니다.");
        const data = await res.json();
        set((state) => ({
            tvVideo: {
                ...state.tvVideo,
                [id]: data.results ?? []
            }
        }));
    },
    // ############# 에피소드별 영상

    // ############# YouTube 에피소드 영상 검색

    episodeVideos: {},

    onFetchEpisodeVideo: async (
        id,
        season,
        episodeNumber,
        tvName = "",
        episodeName = ""
    ) => {
        const key = `${id}-${season}-${episodeNumber}`;
        const { episodeVideos } = get();

        // 이미 검색한 결과가 있으면 재사용
        if (episodeVideos[key]) {
            return episodeVideos[key];
        }

        if (!YOUTUBE_KEY) {
            throw new Error("YouTube API 키가 설정되지 않았습니다.");
        }

        // 프로그램 제목 + 시즌 + 회차 + 에피소드 제목으로 검색
        const query = [
            tvName,
            `시즌 ${season}`,
            `${episodeNumber}화`,
            episodeName,
        ]
            .filter(Boolean)
            .join(" ");

        const searchParams = new URLSearchParams({
            part: "snippet",
            q: query,
            type: "video",
            maxResults: "10",
            videoEmbeddable: "true",
            safeSearch: "moderate",
            key: YOUTUBE_KEY,
        });

        const searchRes = await fetch(
            `https://www.googleapis.com/youtube/v3/search?${searchParams}`
        );

        if (!searchRes.ok) {
            const errorData = await searchRes.json();
            throw new Error(
                errorData.error?.message ||
                "YouTube 영상 검색에 실패했습니다."
            );
        }

        const searchData = await searchRes.json();
        const items = searchData.items ?? [];

        let results = [];

        if (items.length > 0) {
            // 실제로 퍼가기 가능한 영상인지 확인
            const videoIds = items
                .map((item) => item.id.videoId)
                .filter(Boolean);

            if (videoIds.length > 0) {
                const videoParams = new URLSearchParams({
                    part: "status",
                    id: videoIds.join(","),
                    key: YOUTUBE_KEY,
                });

                const videoRes = await fetch(
                    `https://www.googleapis.com/youtube/v3/videos?${videoParams}`
                );

                if (!videoRes.ok) {
                    throw new Error("YouTube 영상 정보를 확인하지 못했습니다.");
                }

                const videoData = await videoRes.json();

                const embeddableIds = new Set(
                    (videoData.items ?? [])
                        .filter(
                            (video) =>
                                video.status?.embeddable &&
                                video.status?.privacyStatus === "public"
                        )
                        .map((video) => video.id)
                );

                results = items
                    .filter((item) => embeddableIds.has(item.id.videoId))
                    .map((item) => ({
                        key: item.id.videoId,
                        name: item.snippet.title,
                        site: "YouTube",
                        type: "Video",
                        channelTitle: item.snippet.channelTitle,
                    }));
            }
        }

        // 검색 결과가 없어도 빈 배열을 저장해 반복 요청 방지
        set((state) => ({
            episodeVideos: {
                ...state.episodeVideos,
                [key]: results,
            },
        }));

        return results;
    },

    // ############# 시즌

    // TV ID별 상세정보 저장
    tvDetails: {},

    // TV ID별 시즌 목록 저장
    seasons: {},

    // TV 상세정보 + 시즌 목록 가져오기
    onFetchSeason: async (id) => {
        const { seasons } = get();

        // 이미 저장된 시즌이면 요청하지 않음
        if (seasons[id]) return;

        const res = await fetch(`https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_KEY}&language=ko-KR`);

        if (!res.ok) throw new Error("시즌 정보를 불러오지 못했습니다.");

        const data = await res.json();
        set((state) => ({
            tvDetails: {
                ...state.tvDetails,
                [id]: data
            },
            seasons: {
                ...state.seasons,
                [id]: data.seasons ?? []
            }
        }));
    },

    // ############# 에피소드

    // TV ID와 시즌 번호별 에피소드 저장
    episodes: {},
    // 특정 시즌의 에피소드 가져오기
    onFetchEpisode: async (id, season) => {
        const { episodes } = get();

        // 동일한 TV라도 시즌마다 다른 에피소드
        const key = `${id}-${season}`;
        // 이미 저장된 에피소드면 요청하지 않음
        if (episodes[key]) return;
        const res = await fetch(`https://api.themoviedb.org/3/tv/${id}/season/${season}?api_key=${TMDB_KEY}&language=ko-KR`);

        if (!res.ok) throw new Error("에피소드를 불러오지 못했습니다.");

        const data = await res.json();
        set((state) => ({
            episodes: {
                ...state.episodes,
                [key]: data.episodes ?? []
            }
        }));
    },
}));
