import { FC } from "react";
import RemixLine from "../remix-line";
import useFormatChartData from "../use-format-chart-data";
import {
  convertISODateStringToLondonTime,
  formatISODateString,
  getRoundedTickBoundary
} from "../../helpers/utils";
import ForecastHeaderGSP from "./forecast-header-gsp";
import useGetGspData from "./use-get-gsp-data";
import useGlobalState, { get30MinNow, getNext30MinSlot } from "../../helpers/globalState";
import Spinner from "../../icons/spinner";
import GSPDeltaForecastHeader from "../delta-view/delta-gsp-header-ui";
import { ForecastValue } from "../../types";

// We want to have the ymax of the graph to be related to the capacity of the GspPvRemixChart
// If we use the raw values, the graph looks funny, i.e y major ticks are 0 100 232
// So, we round these up to the following numbers
const yMax_levels = [
  3, 9, 20, 28, 36, 45, 60, 80, 100, 120, 160, 200, 240, 300, 320, 360, 400, 450, 600
];

const GspPvRemixChart: FC<{
  gspId: number;
  selectedTime: string;
  close: () => void;
  setTimeOfInterest: (t: string) => void;
  timeNow: string;
  resetTime: () => void;
  visibleLines: string[];
  deltaView?: boolean;
}> = ({
  gspId,
  selectedTime,
  close,
  setTimeOfInterest,
  timeNow,
  resetTime,
  visibleLines,
  deltaView = false
}) => {
  //when adding 4hour forecast data back in, add gsp4HourData to list in line 27
  const { errors, fcAll, pvRealDataAfter, pvRealDataIn, gsp4HourData } = useGetGspData(gspId);
  const gspData = fcAll?.forecasts.find((fc) => fc.location.gspId === gspId);
  const gspForecastData = gspData?.forecastValues;
  const gspInfo = gspData?.location;
  const chartData = useFormatChartData({
    forecastData: gspForecastData,
    fourHourData: gsp4HourData,
    pvRealDayInData: pvRealDataIn,
    pvRealDayAfterData: pvRealDataAfter,
    timeTrigger: selectedTime,
    delta: deltaView
  });
  if (errors.length) {
    console.log(errors);
    return <div>failed to load</div>;
  }
  if (!fcAll || !pvRealDataIn || !pvRealDataAfter)
    return (
      <div className="mt-8">
        {/* Header spacer */}
        <div className="h-16"></div>
        <div className="h-60 flex flex-1">
          <Spinner />
        </div>
      </div>
    );
  const now30min = formatISODateString(get30MinNow());
  const forecastAtSelectedTime: NonNullable<typeof gspForecastData>[number] =
    gspForecastData?.find((fc) => formatISODateString(fc?.targetTime) === now30min) || ({} as any);
  const pvPercentage = (forecastAtSelectedTime.expectedPowerGenerationNormalized || 0) * 100;

  const fourHourForecastAtSelectedTime: ForecastValue =
    gsp4HourData?.find((fc) => formatISODateString(fc?.targetTime) === now30min) ||
    ({} as ForecastValue);

  // get pv time
  const selectedPvActualDatetime = pvRealDataIn[0].datetimeUtc;
  console.log("selectedPvActualDatetime", selectedPvActualDatetime);
  // get the time for the OCF Forecast
  const futurePvForecastDatetime = formatISODateString(timeNow);
  const futurePVForecastDatetimeLabel = convertISODateStringToLondonTime(
    futurePvForecastDatetime + ":00.000Z"
  );
  console.log("futurePvForecastDatetime", futurePvForecastDatetime);

  // set ymax to the installed capacity of the graph
  let yMax = gspInfo?.installedCapacityMw || 100;

  const originalForecastAtTimeNow = (
    forecastAtSelectedTime.expectedPowerGenerationMegawatts || 0
  ).toFixed(1);
  const fourHourForecast = (
    fourHourForecastAtSelectedTime.expectedPowerGenerationMegawatts || 0
  ).toFixed(1);
  const deltaValue = (Number(fourHourForecast) - Number(originalForecastAtTimeNow)).toFixed(1);

  yMax = getRoundedTickBoundary(yMax, yMax_levels);
  console.log("timeNow", timeNow);

  if (deltaView) {
    return (
      <>
        <div className="flex-initial">
          <GSPDeltaForecastHeader
            onClose={close}
            deltaValue={deltaValue.toString()}
            installedCapacity={gspInfo?.installedCapacityMw}
            forecastNextPV={fourHourForecast.toString()}
            actualPV={"8"}
            title={gspInfo?.regionName || ""}
            timeNow={timeNow}
            forecastPV={originalForecastAtTimeNow.toString()}
            selectedTimeOnly={"89"}
            pvTimeOnly={convertISODateStringToLondonTime(timeNow)}
            forecastNextTimeOnly={convertISODateStringToLondonTime(
              getNext30MinSlot(new Date(timeNow))?.toISOString()
            )}
          ></GSPDeltaForecastHeader>
        </div>
        {/*<div className="h-60 mt-4 mb-6">*/}
        <RemixLine
          setTimeOfInterest={setTimeOfInterest}
          timeOfInterest={selectedTime}
          data={chartData}
          yMax={yMax!}
          timeNow={timeNow}
          resetTime={resetTime}
          visibleLines={visibleLines}
          deltaView={deltaView}
          deltaYMaxOverride={Math.ceil(Number(gspInfo?.installedCapacityMw) / 200) * 100 || 500}
        />
        {/*</div>*/}
      </>
    );
  }

  return (
    <>
      <div className="flex-initial">
        <ForecastHeaderGSP
          onClose={close}
          title={gspInfo?.regionName || ""}
          mwpercent={Math.round(pvPercentage)}
          deltaView={deltaView}
        >
          <span className="font-semibold dash:3xl:text-5xl dash:xl:text-4xl xl:text-3xl lg:text-2xl md:text-xl text-lg leading-none text-ocf-yellow-500">
            {Math.round(forecastAtSelectedTime.expectedPowerGenerationMegawatts || 0)}
          </span>
          <span className="font-semibold dash:3xl:text-5xl dash:xl:text-4xl xl:text-3xl lg:text-2xl md:text-xl text-lg leading-none text-white">
            {" "}
            / {gspInfo?.installedCapacityMw}
          </span>
          <span className="text-xs dash:text-2xl text-ocf-gray-300"> MW</span>
        </ForecastHeaderGSP>
      </div>
      {/*<div className="h-60 mt-4 mb-6">*/}
      <RemixLine
        setTimeOfInterest={setTimeOfInterest}
        timeOfInterest={selectedTime}
        data={chartData}
        yMax={yMax!}
        timeNow={timeNow}
        resetTime={resetTime}
        visibleLines={visibleLines}
        deltaView={deltaView}
        deltaYMaxOverride={Math.ceil(Number(gspInfo?.installedCapacityMw) / 200) * 100 || 500}
      />
      {/*</div>*/}
    </>
  );
};

export default GspPvRemixChart;
