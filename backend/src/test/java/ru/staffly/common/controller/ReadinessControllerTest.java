package ru.staffly.common.controller;

import org.junit.jupiter.api.Test;
import org.springframework.boot.availability.ApplicationAvailability;
import org.springframework.boot.availability.ReadinessState;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ReadinessControllerTest {
    private final ApplicationAvailability availability = mock(ApplicationAvailability.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(new ReadinessController(availability, jdbc)).build();

    @Test
    void startupAndShutdownRefuseTrafficWithoutQueryingDatabase() throws Exception {
        when(availability.getReadinessState()).thenReturn(ReadinessState.REFUSING_TRAFFIC);
        mvc.perform(get("/api/ready")).andExpect(status().isServiceUnavailable());
        verifyNoInteractions(jdbc);
    }

    @Test
    void readyApplicationWithWorkingDatabaseAcceptsTraffic() throws Exception {
        when(availability.getReadinessState()).thenReturn(ReadinessState.ACCEPTING_TRAFFIC);
        when(jdbc.queryForObject("SELECT 1", Integer.class)).thenReturn(1);
        mvc.perform(get("/api/ready")).andExpect(status().isOk()).andExpect(content().string("ready"));
    }

    @Test
    void databaseFailureReturnsUnavailableWithoutExposingDetails() throws Exception {
        when(availability.getReadinessState()).thenReturn(ReadinessState.ACCEPTING_TRAFFIC);
        when(jdbc.queryForObject("SELECT 1", Integer.class))
                .thenThrow(new DataAccessResourceFailureException("internal connection details"));
        mvc.perform(get("/api/ready")).andExpect(status().isServiceUnavailable())
                .andExpect(content().string("not ready"));
    }
}
