package ru.staffly.training.service;

import org.junit.jupiter.api.Test;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.training.model.TrainingFolder;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class ExamSourceFolderScopeTest {
    final ExamSourceFolderScope scope = new ExamSourceFolderScope();
    TrainingFolder folder(long id, TrainingFolder parent, boolean active) {
        return TrainingFolder.builder().id(id).parent(parent).active(active).build();
    }
    @Test void directScopeDoesNotIncludeChildrenAndRecursiveScopeExcludesHiddenBranches() {
        var root = folder(1, null, true);
        var child = folder(2, root, true);
        var hidden = folder(3, root, false);
        var grandchild = folder(4, hidden, true);
        var other = folder(5, null, true);
        var bank = List.of(root, child, hidden, grandchild, other);
        assertEquals(List.of(root), scope.resolve(root, false, bank));
        assertEquals(List.of(root, child), scope.resolve(root, true, bank));
    }
    @Test void directParentAndChildScopesAreAllowedButOverlappingRecursiveScopesAreRejected() {
        assertDoesNotThrow(() -> scope.assertDisjoint(List.of(Set.of(1L), Set.of(2L))));
        assertThrows(BadRequestException.class, () -> scope.assertDisjoint(List.of(Set.of(1L, 2L), Set.of(2L))));
    }
    @Test void cyclicHierarchyCannotHangSourceResolution() {
        var root = folder(1, null, true);
        var child = folder(2, root, true);
        root.setParent(child);
        assertThrows(BadRequestException.class, () -> scope.resolve(root, true, List.of(root, child)));
    }
}
