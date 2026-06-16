'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/** 카카오맵 API 키 (없으면 지도 대신 주소 텍스트만 표시) */
const KAKAO_MAP_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

interface KakaoMapProps {
  /** 표시 모드: view=읽기전용, select=위치선택 */
  mode: 'view' | 'select';
  /** 초기 주소 */
  address?: string;
  /** 초기 위도 */
  lat?: number;
  /** 초기 경도 */
  lng?: number;
  /** 위치 선택 시 콜백 (select 모드) */
  onSelect?: (data: { address: string; lat: number; lng: number }) => void;
  /** 지도 높이 */
  height?: string;
}

declare global {
  interface Window {
    kakao: any;
  }
}

/**
 * 카카오맵 컴포넌트
 * - API 키가 있으면 지도 표시
 * - API 키가 없으면 주소 텍스트만 표시 (graceful fallback)
 * - select 모드: 주소 검색 + 지도에 핀 찍기
 * - view 모드: 마커가 있는 지도 표시
 */
export default function KakaoMap({ mode, address, lat, lng, onSelect, height = '200px' }: KakaoMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [searchQuery, setSearchQuery] = useState(address || '');
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [error, setError] = useState('');

  /** SDK 스크립트 동적 로드 */
  useEffect(() => {
    if (!KAKAO_MAP_KEY) return;

    // 이미 로드된 경우
    if (window.kakao && window.kakao.maps) {
      if (window.kakao.maps.LatLng) {
        setSdkLoaded(true);
      } else {
        window.kakao.maps.load(() => setSdkLoaded(true));
      }
      return;
    }

    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_MAP_KEY}&libraries=services&autoload=false`;
    script.async = true;

    script.onload = () => {
      window.kakao.maps.load(() => {
        setSdkLoaded(true);
      });
    };

    script.onerror = () => {
      setError('카카오맵 SDK 로드에 실패했습니다.');
    };

    document.head.appendChild(script);

    // 잘못된 키 등으로 콜백이 영영 안 오는 경우를 대비한 타임아웃 (무한 스피너 방지)
    const timeoutId = window.setTimeout(() => {
      setSdkLoaded((loaded) => {
        if (!loaded) setError('지도를 불러오지 못했습니다. 주소만 표시합니다.');
        return loaded;
      });
    }, 10000);

    return () => window.clearTimeout(timeoutId);
  }, []);

  /** 지도 초기화 */
  useEffect(() => {
    if (!sdkLoaded || !mapRef.current) return;

    const { kakao } = window;
    const defaultLat = lat && lat !== 0 ? lat : 37.5665;
    const defaultLng = lng && lng !== 0 ? lng : 126.978;

    const mapOption = {
      center: new kakao.maps.LatLng(defaultLat, defaultLng),
      level: 3,
    };

    const map = new kakao.maps.Map(mapRef.current, mapOption);
    mapInstanceRef.current = map;

    // 초기 마커 설정 (좌표가 있는 경우)
    if (lat && lng && lat !== 0 && lng !== 0) {
      const position = new kakao.maps.LatLng(lat, lng);
      const marker = new kakao.maps.Marker({ position, map });
      markerRef.current = marker;
    }

    // select 모드: 지도 클릭 시 마커 이동 + 주소 역변환
    if (mode === 'select') {
      kakao.maps.event.addListener(map, 'click', (mouseEvent: any) => {
        const latlng = mouseEvent.latLng;
        placeMarker(latlng.getLat(), latlng.getLng(), map);

        // 역 지오코딩으로 주소 가져오기
        const geocoder = new kakao.maps.services.Geocoder();
        geocoder.coord2Address(latlng.getLng(), latlng.getLat(), (result: any, status: any) => {
          if (status === kakao.maps.services.Status.OK && result[0]) {
            const addr = result[0].road_address
              ? result[0].road_address.address_name
              : result[0].address.address_name;
            setSearchQuery(addr);
            onSelect?.({ address: addr, lat: latlng.getLat(), lng: latlng.getLng() });
          }
        });
      });
    }
  }, [sdkLoaded]);

  /** 마커 배치 헬퍼 */
  const placeMarker = useCallback((markerLat: number, markerLng: number, map?: any) => {
    const { kakao } = window;
    const targetMap = map || mapInstanceRef.current;
    if (!targetMap) return;

    const position = new kakao.maps.LatLng(markerLat, markerLng);

    if (markerRef.current) {
      markerRef.current.setPosition(position);
    } else {
      const marker = new kakao.maps.Marker({ position, map: targetMap });
      markerRef.current = marker;
    }

    targetMap.setCenter(position);
  }, []);

  /** 주소 검색 (select 모드) */
  const handleSearch = useCallback(() => {
    if (!sdkLoaded || !searchQuery.trim()) return;

    const { kakao } = window;
    const geocoder = new kakao.maps.services.Geocoder();

    geocoder.addressSearch(searchQuery.trim(), (result: any, status: any) => {
      if (status === kakao.maps.services.Status.OK && result[0]) {
        const resultLat = parseFloat(result[0].y);
        const resultLng = parseFloat(result[0].x);
        const addr = result[0].road_address
          ? result[0].road_address.address_name
          : result[0].address_name;

        placeMarker(resultLat, resultLng);
        setSearchQuery(addr);
        onSelect?.({ address: addr, lat: resultLat, lng: resultLng });
      } else {
        // 장소 검색으로 재시도
        const ps = new kakao.maps.services.Places();
        ps.keywordSearch(searchQuery.trim(), (data: any, psStatus: any) => {
          if (psStatus === kakao.maps.services.Status.OK && data[0]) {
            const placeLat = parseFloat(data[0].y);
            const placeLng = parseFloat(data[0].x);
            const placeName = data[0].address_name || data[0].place_name;

            placeMarker(placeLat, placeLng);
            setSearchQuery(placeName);
            onSelect?.({ address: placeName, lat: placeLat, lng: placeLng });
          } else {
            setError('검색 결과가 없습니다. 다른 주소를 입력해주세요.');
            setTimeout(() => setError(''), 3000);
          }
        });
      }
    });
  }, [sdkLoaded, searchQuery, placeMarker, onSelect]);

  // === API 키 없을 때 Fallback UI ===
  if (!KAKAO_MAP_KEY) {
    return (
      <div
        className="bg-gray-100 rounded-xl flex flex-col items-center justify-center border border-gray-200"
        style={{ height }}
      >
        {/* 지도 아이콘 */}
        <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>

        {address ? (
          <p className="text-sm text-gray-600 text-center px-4">{address}</p>
        ) : (
          <p className="text-xs text-gray-400">지도를 사용하려면 카카오맵 API 키가 필요합니다</p>
        )}

        {/* select 모드: 간단한 주소 입력 */}
        {mode === 'select' && (
          <div className="mt-2 w-full px-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onBlur={() => {
                if (searchQuery.trim()) {
                  onSelect?.({ address: searchQuery.trim(), lat: 0, lng: 0 });
                }
              }}
              placeholder="주소를 입력해주세요"
              className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        )}
      </div>
    );
  }

  // === SDK 로드 실패 → 주소 텍스트 fallback (무한 스피너 방지, #35) ===
  if (!sdkLoaded && error) {
    return (
      <div
        className="bg-gray-100 rounded-xl flex flex-col items-center justify-center border border-gray-200 px-4 text-center"
        style={{ height }}
      >
        <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {address ? (
          <p className="text-sm text-gray-600">{address}</p>
        ) : (
          <p className="text-xs text-gray-400">지도를 표시할 수 없습니다</p>
        )}
      </div>
    );
  }

  // === SDK 로드 중 ===
  if (!sdkLoaded) {
    return (
      <div
        className="bg-gray-50 rounded-xl flex items-center justify-center border border-gray-200"
        style={{ height }}
      >
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-primary-500" />
          <span>지도 로딩 중...</span>
        </div>
      </div>
    );
  }

  // === 카카오맵 UI ===
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200">
      {/* select 모드: 검색바 */}
      {mode === 'select' && (
        <div className="flex gap-2 p-2 bg-gray-50 border-b border-gray-200">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
              }
            }}
            placeholder="주소 또는 장소를 검색하세요"
            className="flex-1 py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            type="button"
            onClick={handleSearch}
            className="px-3 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors"
          >
            검색
          </button>
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className="px-3 py-2 bg-red-50 text-red-500 text-xs">
          {error}
        </div>
      )}

      {/* 지도 영역 */}
      <div ref={mapRef} style={{ width: '100%', height }} />
    </div>
  );
}
