import { Box, Button, Stack, Typography } from "@mui/material";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { Messages } from "../../shared/i18n";

export function AboutTab({ t }: { t: Messages }) {
  const [showAllReleases, setShowAllReleases] = useState(false);
  const releases = [
    {
      version: t.options.about.releases.v1_5.version,
      summary: t.options.about.releases.v1_5.summary,
      features: [
        t.options.about.releases.v1_5.feature1,
        t.options.about.releases.v1_5.feature2,
        t.options.about.releases.v1_5.feature3,
      ],
    },
    {
      version: t.options.about.releases.v1_4.version,
      summary: t.options.about.releases.v1_4.summary,
      features: [
        t.options.about.releases.v1_4.feature1,
        t.options.about.releases.v1_4.feature2,
        t.options.about.releases.v1_4.feature3,
        t.options.about.releases.v1_4.feature4,
      ],
    },
    {
      version: t.options.about.releases.v1_3.version,
      summary: t.options.about.releases.v1_3.summary,
      features: [
        t.options.about.releases.v1_3.feature1,
        t.options.about.releases.v1_3.feature2,
        t.options.about.releases.v1_3.feature3,
      ],
    },
    {
      version: t.options.about.releases.v1_2_1.version,
      summary: t.options.about.releases.v1_2_1.summary,
      features: [
        t.options.about.releases.v1_2_1.feature1,
        t.options.about.releases.v1_2_1.feature2,
        t.options.about.releases.v1_2_1.feature3,
      ],
    },
    {
      version: t.options.about.releases.v1_2.version,
      summary: t.options.about.releases.v1_2.summary,
      features: [
        t.options.about.releases.v1_2.feature1,
        t.options.about.releases.v1_2.feature2,
        t.options.about.releases.v1_2.feature3,
        t.options.about.releases.v1_2.feature4,
        t.options.about.releases.v1_2.feature5,
        t.options.about.releases.v1_2.feature6,
        t.options.about.releases.v1_2.feature7,
      ],
    },
    {
      version: t.options.about.releases.v1_1.version,
      summary: t.options.about.releases.v1_1.summary,
      features: [
        t.options.about.releases.v1_1.feature1,
        t.options.about.releases.v1_1.feature2,
      ],
    },
    {
      version: t.options.about.releases.v1_0.version,
      summary: t.options.about.releases.v1_0.summary,
      features: [
        t.options.about.releases.v1_0.feature1,
        t.options.about.releases.v1_0.feature2,
        t.options.about.releases.v1_0.feature3,
        t.options.about.releases.v1_0.feature4,
        t.options.about.releases.v1_0.feature5,
      ],
    },
  ];
  const visibleReleases = showAllReleases
    ? releases
    : releases.slice(0, DEFAULT_VISIBLE_RELEASE_COUNT);
  const hasOlderReleases = releases.length > DEFAULT_VISIBLE_RELEASE_COUNT;

  return (
    <Stack spacing={3} maxWidth={860}>
      <Box>
        <Typography variant="h6" gutterBottom>
          {t.options.about.releases.title}
        </Typography>
        <Stack id="release-history" spacing={2.5}>
          {visibleReleases.map((release) => (
            <Stack spacing={1} key={release.version}>
              <Typography variant="subtitle1" fontWeight={700}>
                {release.version}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {release.summary}
              </Typography>
              <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
                {release.features.map((feature) => (
                  <Typography
                    component="li"
                    variant="body2"
                    key={feature}
                    sx={{ mb: 0.75 }}
                  >
                    {feature}
                  </Typography>
                ))}
              </Box>
            </Stack>
          ))}
          {hasOlderReleases && (
            <Box>
              <Button
                variant="text"
                size="small"
                aria-controls="release-history"
                aria-expanded={showAllReleases}
                endIcon={
                  showAllReleases ? (
                    <ChevronUp size={15} />
                  ) : (
                    <ChevronDown size={15} />
                  )
                }
                onClick={() => setShowAllReleases((current) => !current)}
                sx={{ px: 0.5 }}
              >
                {showAllReleases
                  ? t.options.about.releases.showLess
                  : t.options.about.releases.showMore}
              </Button>
            </Box>
          )}
        </Stack>
      </Box>
    </Stack>
  );
}

const DEFAULT_VISIBLE_RELEASE_COUNT = 4;
