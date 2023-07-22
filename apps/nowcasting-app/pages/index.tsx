import { useUser, withPageAuthRequired } from "@auth0/nextjs-auth0";
import Layout from "../components/layout/layout";
import { PvLatestMap } from "../components/map";
import SideLayout from "../components/side-layout";
import PvRemixChart from "../components/charts/pv-remix-chart";
import useAndUpdateSelectedTime from "../components/hooks/use-and-update-selected-time";
import React, { useEffect, useMemo, useState } from "react";
import Cookies from "cookies";
import Header from "../components/layout/header";
import DeltaViewChart from "../components/charts/delta-view/delta-view-chart";
import { API_PREFIX, DELTA_BUCKET, SITES_API_PREFIX, VIEWS } from "../constant";
import useGlobalState from "../components/helpers/globalState";
import {
  AllGspRealData,
  AllSites,
  CombinedData,
  CombinedErrors,
  CombinedSitesData,
  ForecastData,
  GspAllForecastData,
  National4HourData,
  PvRealData,
  SitePvActual,
  SitePvForecast,
  SitesPvActual,
  SitesPvForecast
} from "../components/types";
import {
  axiosFetcherAuth,
  formatISODateString,
  getDeltaBucket,
  isProduction
} from "../components/helpers/utils";
import useSWR from "swr";
import { ActiveUnit } from "../components/map/types";
import DeltaMap from "../components/map/deltaMap";
import * as Sentry from "@sentry/nextjs";
import SolarSiteChart from "../components/charts/solar-site-view/solar-site-chart";
import SitesMap from "../components/map/sitesMap";
import { useFormatSitesData } from "../components/hooks/useFormatSitesData";
import {
  CookieStorageKeys,
  setArraySettingInCookieStorage
} from "../components/helpers/cookieStorage";

export default function Home({ dashboardModeServer }: { dashboardModeServer: string }) {
  useAndUpdateSelectedTime();
  const [view, setView] = useGlobalState("view");
  const [activeUnit, setActiveUnit] = useState<ActiveUnit>(ActiveUnit.MW);
  const [show4hView] = useGlobalState("show4hView");
  const [selectedISOTime] = useGlobalState("selectedISOTime");
  const selectedTime = formatISODateString(selectedISOTime || new Date().toISOString());
  const [timeNow] = useGlobalState("timeNow");
  const { user, isLoading, error } = useUser();
  const [maps] = useGlobalState("maps");
  const [lat] = useGlobalState("lat");
  const [lng] = useGlobalState("lng");
  const [zoom] = useGlobalState("zoom");
  const [largeScreenMode] = useGlobalState("dashboardMode");
  const [visibleLines] = useGlobalState("visibleLines");

  // Local state used to set initial state on server side render, then updated by global state
  const [combinedDashboardModeActive, setCombinedDashboardModeActive] = useState(
    dashboardModeServer === "true"
  );
  useEffect(() => {
    setCombinedDashboardModeActive(largeScreenMode);
  }, [largeScreenMode]);

  useEffect(() => {
    setArraySettingInCookieStorage(CookieStorageKeys.VISIBLE_LINES, visibleLines);
  }, [visibleLines]);

  const currentView = (v: VIEWS) => v === view;

  useEffect(() => {
    if (user && !isLoading && !error) {
      Sentry.setUser({
        id: user.sub || "",
        email: user.email || "",
        username: user.nickname || "",
        name: user.name,
        locale: user.locale,
        avatar: user.picture
      });
    }
  }, [user, isLoading, error]);

  useEffect(() => {
    maps.forEach((map) => {
      if (map.getCanvas()?.style.width === "400px") {
        console.log("-- -- -- resizing map");
        map.resize();
      }
    });
  }, [view, maps]);

  useEffect(() => {
    maps.forEach((map) => {
      console.log("-- -- -- resizing map");
      map.resize();
    });
  }, [combinedDashboardModeActive]);

  useEffect(() => {
    maps.forEach((map, index) => {
      if (map.getContainer().dataset.title === view) return;

      if (map.getCenter().lat !== lat || map.getCenter().lng !== lng) {
        map.setCenter([lng, lat]);
      }
      if (map.getZoom() !== zoom) {
        map.setZoom(zoom);
      }
    });
  }, [lat, lng, zoom]);

  // Assuming first item in the array is the latest
  // const useGetForecastsData = (isNormalized: boolean) => {
  //   const [forecastLoading, setForecastLoading] = useState(true);
  //   const [, setForecastCreationTime] = useGlobalState("forecastCreationTime");
  //   // const bareForecastData = useSWRImmutable<FcAllResData>(
  //   //   () => getAllForecastUrl(false, false),
  //   //   axiosFetcherAuth,
  //   //   {
  //   //     onSuccess: (data) => {
  //   //       if (data.forecasts?.length)
  //   //         setForecastCreationTime(data.forecasts[0].forecastCreationTime);
  //   //       setForecastLoading(false);
  //   //     }
  //   //   }
  //   // );
  //
  //   const allForecastData = useSWR<GspAllForecastData>(
  //     () => getAllForecastUrl(true, true),
  //     axiosFetcherAuth,
  //     {
  //       refreshInterval: 1000 * 60 * 5, // 5min
  //       // isPaused: () => forecastLoading,
  //       onSuccess: (data) => {
  //         setForecastCreationTime(data.forecasts[0].forecastCreationTime);
  //       }
  //     }
  //   );
  //   console.log("allForecastData", allForecastData);
  //   // useEffect(() => {
  //   //   if (!forecastLoading) {
  //   //     allForecastData.mutate();
  //   //   }
  //   // }, [forecastLoading]);
  //
  //   // if (isNormalized) return allForecastData;
  //   // else return allForecastData.data ? allForecastData : [];
  //   return allForecastData?.data ? allForecastData : { data: { forecasts: [] } };
  // };

  const { data: nationalForecastData, error: nationalForecastError } = useSWR<ForecastData>(
    `${API_PREFIX}/solar/GB/national/forecast?historic=false&only_forecast_values=true&UI`,
    axiosFetcherAuth,
    {
      refreshInterval: 60 * 1000 * 5 // 5min
    }
  );
  const { data: pvRealDayInData, error: pvRealDayInError } = useSWR<PvRealData>(
    `${API_PREFIX}/solar/GB/national/pvlive?regime=in-day&UI`,
    axiosFetcherAuth,
    {
      refreshInterval: 60 * 1000 * 5 // 5min
    }
  );
  const { data: pvRealDayAfterData, error: pvRealDayAfterError } = useSWR<PvRealData>(
    `${API_PREFIX}/solar/GB/national/pvlive?regime=day-after&UI`,
    axiosFetcherAuth,
    {
      refreshInterval: 60 * 1000 * 5 // 5min
    }
  );
  const { data: national4HourData, error: national4HourError } = useSWR<National4HourData>(
    show4hView
      ? `${API_PREFIX}/solar/GB/national/forecast?forecast_horizon_minutes=240&historic=true&only_forecast_values=true&UI`
      : null,
    axiosFetcherAuth,
    {
      refreshInterval: 60 * 1000 * 5 // 5min
    }
  );
  const { data: allGspForecastData, error: allGspForecastError } = useSWR<GspAllForecastData>(
    `${API_PREFIX}/solar/GB/gsp/forecast/all/?historic=true&UI`,
    axiosFetcherAuth,
    {
      refreshInterval: 60 * 1000 * 5 // 5min
    }
  );
  const { data: allGspRealData, error: allGspRealError } = useSWR<AllGspRealData>(
    `${API_PREFIX}/solar/GB/gsp/pvlive/all?regime=in-day&UI`,
    axiosFetcherAuth,
    {
      refreshInterval: 60 * 1000 * 5 // 5min
    }
  );

  const currentYields =
    allGspRealData?.map((datum) => {
      const gspYield = datum.gspYields.find((yieldDatum, index) => {
        return yieldDatum.datetimeUtc === `${selectedTime}:00+00:00`;
      });
      return {
        gspId: datum.gspId,
        gspRegion: datum.regionName,
        gspCapacity: datum.installedCapacityMw,
        yield: gspYield?.solarGenerationKw || 0
      };
    }) || [];
  const gspDeltas = useMemo(() => {
    let tempGspDeltas = new Map();

    for (let i = 0; i < currentYields.length; i++) {
      const currentYield = currentYields[i];
      let gspForecastData = allGspForecastData?.forecasts[i];
      if (gspForecastData?.location.gspId !== currentYield.gspId) {
        gspForecastData = allGspForecastData?.forecasts.find((gspForecastDatum) => {
          return gspForecastDatum.location.gspId === currentYield.gspId;
        });
      }
      const currentGspForecast = gspForecastData?.forecastValues.find((forecastValue) => {
        return forecastValue.targetTime === `${selectedTime}:00+00:00`;
      });
      const isFutureOrNoYield = `${selectedTime}:00.000Z` >= timeNow || !currentYield.yield;
      const delta = isFutureOrNoYield
        ? 0
        : currentYield.yield / 1000 - (currentGspForecast?.expectedPowerGenerationMegawatts || 0);
      const deltaNormalized = isFutureOrNoYield
        ? 0
        : (currentYield.yield / 1000 -
            (currentGspForecast?.expectedPowerGenerationMegawatts || 0)) /
            currentYield.gspCapacity || 0;
      const deltaBucket = getDeltaBucket(delta);
      tempGspDeltas.set(currentYield.gspId, {
        gspId: currentYield.gspId,
        gspRegion: currentYield.gspRegion,
        gspCapacity: currentYield.gspCapacity,
        currentYield: currentYield.yield / 1000,
        forecast: currentGspForecast?.expectedPowerGenerationMegawatts || 0,
        delta,
        deltaPercentage:
          (currentYield.yield /
            1000 /
            (currentGspForecast?.expectedPowerGenerationMegawatts || 0)) *
          100,
        deltaNormalized,
        deltaBucket: deltaBucket,
        deltaBucketKey: DELTA_BUCKET[deltaBucket]
      });
    }
    console.log("gspDeltas calculated");
    console.log(
      "gspDeltas",
      Array.from(tempGspDeltas)
        .filter((gspDelta) => gspDelta[1].delta > 0)
        .map((gspDelta, index) => {
          const delta = gspDelta[1].delta;
          return delta;
        })
    );
    return tempGspDeltas;
  }, [allGspForecastData, allGspRealData, selectedTime]);

  const combinedData: CombinedData = {
    nationalForecastData,
    pvRealDayInData,
    pvRealDayAfterData,
    national4HourData,
    allGspForecastData,
    allGspRealData,
    gspDeltas
  };
  const combinedErrors: CombinedErrors = {
    nationalForecastError,
    pvRealDayInError,
    pvRealDayAfterError,
    national4HourError,
    allGspForecastError,
    allGspRealError
  };

  // Sites API data
  const { data: allSitesData, error: allSitesError } = useSWR<AllSites>(
    `${SITES_API_PREFIX}/sites`,
    axiosFetcherAuth,
    {
      isPaused: () => {
        console.log("isPaused", !currentView(VIEWS.SOLAR_SITES));
        return !currentView(VIEWS.SOLAR_SITES);
      }
    }
  );
  const slicedSitesData = allSitesData?.site_list.slice(0, 100) || [];
  const siteUuids = slicedSitesData.map((site) => site.site_uuid);
  const siteUuidsString = siteUuids?.join(",");
  const { data: sitePvForecastData, error: sitePvForecastError } = useSWR<SitesPvForecast, any>(
    `${SITES_API_PREFIX}/sites/pv_forecast?site_uuids=${siteUuidsString}`,
    axiosFetcherAuth,
    {
      isPaused: () => !siteUuidsString?.length || !currentView(VIEWS.SOLAR_SITES),
      dedupingInterval: 10000,
      refreshInterval: 60 * 1000 * 5 // 5min
    }
  );

  const { data: sitesPvActualData, error: sitePvActualError } = useSWR<SitesPvActual>(
    `${SITES_API_PREFIX}/sites/pv_actual?site_uuids=${siteUuidsString}`,
    axiosFetcherAuth,
    {
      isPaused: () => !siteUuidsString?.length || !currentView(VIEWS.SOLAR_SITES),
      dedupingInterval: 10000,
      refreshInterval: 60 * 1000 * 5 // 5min
    }
  );

  const sitesData: CombinedSitesData = {
    allSitesData: slicedSitesData,
    sitesPvForecastData: sitePvForecastData?.filter((d): d is SitePvForecast => !!d) || [],
    sitesPvActualData: sitesPvActualData?.filter((d): d is SitePvActual => !!d) || []
  };

  const sitesErrors = {
    allSitesError,
    sitesPvForecastError: sitePvForecastError,
    sitesPvActualError: sitePvActualError
  };

  // console.log("cookies", cookies().getAll());

  const aggregatedSitesData = useFormatSitesData(sitesData, selectedISOTime);

  const closedWidth = combinedDashboardModeActive ? "50%" : "56%";

  return (
    <Layout>
      <div
        className={`h-full relative pt-16${
          combinedDashboardModeActive ? " @container dashboard-mode" : ""
        }`}
      >
        <Header view={view} setView={setView} />
        <div
          id="map-container"
          className={`relative float-right h-full`}
          style={{ width: closedWidth }}
        >
          <PvLatestMap
            className={currentView(VIEWS.FORECAST) ? "" : "hidden"}
            combinedData={combinedData}
            combinedErrors={combinedErrors}
            activeUnit={activeUnit}
            setActiveUnit={setActiveUnit}
          />
          {!isProduction && (
            <SitesMap
              className={currentView(VIEWS.SOLAR_SITES) ? "" : "hidden"}
              sitesData={sitesData}
              aggregatedSitesData={aggregatedSitesData}
              sitesErrors={sitesErrors}
              activeUnit={activeUnit}
              setActiveUnit={setActiveUnit}
            />
          )}
          <DeltaMap
            className={currentView(VIEWS.DELTA) ? "" : "hidden"}
            combinedData={combinedData}
            combinedErrors={combinedErrors}
            activeUnit={activeUnit}
            setActiveUnit={setActiveUnit}
          />
        </div>

        <SideLayout dashboardModeActive={combinedDashboardModeActive}>
          <PvRemixChart
            combinedData={combinedData}
            combinedErrors={combinedErrors}
            className={currentView(VIEWS.FORECAST) ? "" : "hidden"}
          />
          {!isProduction && (
            <SolarSiteChart
              combinedSitesData={sitesData}
              aggregatedSitesData={aggregatedSitesData}
              className={currentView(VIEWS.SOLAR_SITES) ? "" : "hidden"}
            />
          )}
          <DeltaViewChart
            combinedData={combinedData}
            combinedErrors={combinedErrors}
            className={currentView(VIEWS.DELTA) ? "" : "hidden"}
          />
        </SideLayout>
      </div>
    </Layout>
  );
}

export const getServerSideProps = withPageAuthRequired({
  async getServerSideProps(context) {
    const cookies = new Cookies(context.req, context.res);
    return {
      props: {
        dashboardModeServer: cookies.get(CookieStorageKeys.DASHBOARD_MODE) || false
      }
    };
  }
});
