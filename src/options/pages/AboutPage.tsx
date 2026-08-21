import { Box, Stack, Typography } from "@mui/material";
import type { Messages } from "../../shared/i18n";

export function AboutTab({ t }: { t: Messages }) {
  const releases = [
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

  return (
    <Stack spacing={3} maxWidth={860}>
      <Box>
        <Typography variant="h6" gutterBottom>
          {t.options.about.releases.title}
        </Typography>
        <Stack spacing={2.5}>
          {releases.map((release) => (
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
        </Stack>
      </Box>
    </Stack>
  );
}
