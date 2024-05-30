import { IRBAC, MasterAccessManagement } from "@/generated-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
  CREATE_PERMISSION,
  DELETE_PERMISSION,
  CONSTANTS_REGISTRY_RESOURCE,
  MASTER_REGISTRY_RESOURCE,
  UPDATE_PERMISSION,
  REVIEWABLE_REQUESTS_RESOURCE,
  EXECUTE_PERMISSION,
} from "../utils/constants";

import { Reverter } from "../helpers/reverter";

import { ethers } from "hardhat";
import { expect } from "chai";

describe("MasterAccessManagement", async () => {
  const reverter = new Reverter();

  let OWNER: SignerWithAddress;
  let USER1: SignerWithAddress;

  let masterAccess: MasterAccessManagement;

  const MasterContractsRegistryRole = "MCR";
  const ConstantsRegistryRole = "CR";
  const ReviewableRequestsRole = "RR";

  const MasterContractsRegistryCreate: IRBAC.ResourceWithPermissionsStruct = {
    resource: MASTER_REGISTRY_RESOURCE,
    permissions: [CREATE_PERMISSION],
  };
  const MasterContractsRegistryUpdate: IRBAC.ResourceWithPermissionsStruct = {
    resource: MASTER_REGISTRY_RESOURCE,
    permissions: [UPDATE_PERMISSION],
  };
  const MasterContractsRegistryDelete: IRBAC.ResourceWithPermissionsStruct = {
    resource: MASTER_REGISTRY_RESOURCE,
    permissions: [DELETE_PERMISSION],
  };

  const ConstantsRegistryCreate: IRBAC.ResourceWithPermissionsStruct = {
    resource: CONSTANTS_REGISTRY_RESOURCE,
    permissions: [CREATE_PERMISSION],
  };
  const ConstantsRegistryDelete: IRBAC.ResourceWithPermissionsStruct = {
    resource: CONSTANTS_REGISTRY_RESOURCE,
    permissions: [DELETE_PERMISSION],
  };

  const ReviewableRequestsCreate: IRBAC.ResourceWithPermissionsStruct = {
    resource: REVIEWABLE_REQUESTS_RESOURCE,
    permissions: [CREATE_PERMISSION],
  };
  const ReviewableRequestsExecute: IRBAC.ResourceWithPermissionsStruct = {
    resource: REVIEWABLE_REQUESTS_RESOURCE,
    permissions: [EXECUTE_PERMISSION],
  };
  const ReviewableRequestsDelete: IRBAC.ResourceWithPermissionsStruct = {
    resource: REVIEWABLE_REQUESTS_RESOURCE,
    permissions: [DELETE_PERMISSION],
  };

  before("setup", async () => {
    [OWNER, USER1] = await ethers.getSigners();

    const MasterAccessManagementFactory = await ethers.getContractFactory(
      "MasterAccessManagement"
    );
    masterAccess = await MasterAccessManagementFactory.deploy();

    await masterAccess.__MasterAccessManagement_init(OWNER);

    await reverter.snapshot();
  });

  afterEach("revert", reverter.revert);

  describe("basic access", () => {
    it("should not initialize twice", async () => {
      await expect(
        masterAccess.__MasterAccessManagement_init(OWNER)
      ).to.be.rejectedWith("Initializable: contract is already initialized");
    });
  });

  describe("getters", () => {
    describe("MasterContractsRegistry", () => {
      it("should correctly check access for hasMasterContractsRegistryCreatePermission", async () => {
        await masterAccess.addPermissionsToRole(
          MasterContractsRegistryRole,
          [MasterContractsRegistryCreate],
          true
        );

        await expect(
          await masterAccess.hasMasterContractsRegistryCreatePermission(USER1)
        ).to.be.false;

        await masterAccess.grantRoles(USER1, [MasterContractsRegistryRole]);

        expect(
          await masterAccess.hasMasterContractsRegistryCreatePermission(USER1)
        ).to.be.true;
      });

      it("should correctly check access for hasMasterContractsRegistryUpdatePermission", async () => {
        await masterAccess.addPermissionsToRole(
          MasterContractsRegistryRole,
          [MasterContractsRegistryUpdate],
          true
        );

        await expect(
          await masterAccess.hasMasterContractsRegistryUpdatePermission(USER1)
        ).to.be.false;

        await masterAccess.grantRoles(USER1, [MasterContractsRegistryRole]);

        expect(
          await masterAccess.hasMasterContractsRegistryUpdatePermission(USER1)
        ).to.be.true;
      });

      it("should correctly check access for hasMasterContractsRegistryDeletePermission", async () => {
        await masterAccess.addPermissionsToRole(
          MasterContractsRegistryRole,
          [MasterContractsRegistryDelete],
          true
        );

        await expect(
          await masterAccess.hasMasterContractsRegistryDeletePermission(USER1)
        ).to.be.false;

        await masterAccess.grantRoles(USER1, [MasterContractsRegistryRole]);

        expect(
          await masterAccess.hasMasterContractsRegistryDeletePermission(USER1)
        ).to.be.true;
      });
    });

    describe("ConstantsRegistry", () => {
      it("should correctly check access for hasConstantsRegistryCreatePermission", async () => {
        await masterAccess.addPermissionsToRole(
          ConstantsRegistryRole,
          [ConstantsRegistryCreate],
          true
        );

        await expect(
          await masterAccess.hasConstantsRegistryCreatePermission(USER1)
        ).to.be.false;

        await masterAccess.grantRoles(USER1, [ConstantsRegistryRole]);

        expect(await masterAccess.hasConstantsRegistryCreatePermission(USER1))
          .to.be.true;
      });

      it("should correctly check access for hasConstantsRegistryDeletePermission", async () => {
        await masterAccess.addPermissionsToRole(
          ConstantsRegistryRole,
          [ConstantsRegistryDelete],
          true
        );

        await expect(
          await masterAccess.hasConstantsRegistryDeletePermission(USER1)
        ).to.be.false;

        await masterAccess.grantRoles(USER1, [ConstantsRegistryRole]);

        expect(await masterAccess.hasConstantsRegistryDeletePermission(USER1))
          .to.be.true;
      });
    });

    describe("ReviewableRequests", () => {
      it("should correctly check access for hasReviewableRequestsCreatePermission", async () => {
        await masterAccess.addPermissionsToRole(
          ReviewableRequestsRole,
          [ReviewableRequestsCreate],
          true
        );

        expect(await masterAccess.hasReviewableRequestsCreatePermission(USER1))
          .to.be.false;

        await masterAccess.grantRoles(USER1, [ReviewableRequestsRole]);

        expect(await masterAccess.hasReviewableRequestsCreatePermission(USER1))
          .to.be.true;
      });

      it("should correctly check access for hasReviewableRequestsExecutePermission", async () => {
        await masterAccess.addPermissionsToRole(
          ReviewableRequestsRole,
          [ReviewableRequestsExecute],
          true
        );

        expect(await masterAccess.hasReviewableRequestsExecutePermission(USER1))
          .to.be.false;

        await masterAccess.grantRoles(USER1, [ReviewableRequestsRole]);

        expect(await masterAccess.hasReviewableRequestsExecutePermission(USER1))
          .to.be.true;
      });

      it("should correctly check access for hasReviewableRequestsDeletePermission", async () => {
        await masterAccess.addPermissionsToRole(
          ReviewableRequestsRole,
          [ReviewableRequestsDelete],
          true
        );

        expect(await masterAccess.hasReviewableRequestsDeletePermission(USER1))
          .to.be.false;

        await masterAccess.grantRoles(USER1, [ReviewableRequestsRole]);

        expect(await masterAccess.hasReviewableRequestsDeletePermission(USER1))
          .to.be.true;
      });
    });
  });

  describe("addCombinedPermissionsToRole", () => {
    it("should emit AddedRoleWithDescription event", async () => {
      const description = "Allows dropping requests";

      let tx = await masterAccess.addCombinedPermissionsToRole(
        ReviewableRequestsRole,
        description,
        [ReviewableRequestsDelete],
        []
      );
      const receipt = await tx.wait();

      if (receipt) {
        expect(receipt.logs[0].fragment.name).to.be.equal("AddedPermissions");
        expect(receipt.logs[1].fragment.name).to.be.equal(
          "AddedRoleWithDescription"
        );
        expect(receipt.logs[1].args.role).to.be.equal(ReviewableRequestsRole);
        expect(receipt.logs[1].args.description).to.be.equal(description);
      }
      expect(await masterAccess.hasReviewableRequestsDeletePermission(USER1)).to
        .be.false;

      await masterAccess.grantRoles(USER1, [ReviewableRequestsRole]);

      expect(await masterAccess.hasReviewableRequestsDeletePermission(USER1)).to
        .be.true;
    });

    it("should add both permissions", async () => {
      const description = "Disallows dropping requests";

      let tx = await masterAccess.addCombinedPermissionsToRole(
        ReviewableRequestsRole,
        description,
        [ReviewableRequestsDelete],
        [ReviewableRequestsDelete]
      );
      const receipt = await tx.wait();

      if (receipt) {
        expect(receipt.logs[0].fragment.name).to.be.equal("AddedPermissions");
        expect(receipt.logs[1].fragment.name).to.be.equal("AddedPermissions");
        expect(receipt.logs[2].fragment.name).to.be.equal(
          "AddedRoleWithDescription"
        );
        expect(receipt.logs[2].args.role).to.be.equal(ReviewableRequestsRole);
        expect(receipt.logs[2].args.description).to.be.equal(description);
      }

      expect(await masterAccess.hasReviewableRequestsDeletePermission(USER1)).to
        .be.false;

      await masterAccess.grantRoles(USER1, [ReviewableRequestsRole]);

      expect(await masterAccess.hasReviewableRequestsDeletePermission(USER1)).to
        .be.false;
    });
  });

  describe("removeCombinedPermissionsFromRole", () => {
    it("should remove both roles", async () => {
      await masterAccess.addCombinedPermissionsToRole(
        ReviewableRequestsRole,
        "Disallows dropping requests",
        [ReviewableRequestsDelete],
        [ReviewableRequestsDelete]
      );

      await masterAccess.grantRoles(USER1, [ReviewableRequestsRole]);

      expect(await masterAccess.hasReviewableRequestsDeletePermission(USER1));

      await masterAccess.removeCombinedPermissionsFromRole(
        ReviewableRequestsRole,
        [],
        [ReviewableRequestsDelete]
      );

      expect(await masterAccess.hasReviewableRequestsDeletePermission(USER1)).to
        .be.true;

      await masterAccess.removeCombinedPermissionsFromRole(
        ReviewableRequestsRole,
        [ReviewableRequestsDelete],
        []
      );

      expect(await masterAccess.hasReviewableRequestsDeletePermission(USER1));
    });
  });

  describe("updateRolePermissions", () => {
    it("should update the role", async () => {
      await masterAccess.addCombinedPermissionsToRole(
        ReviewableRequestsRole,
        "Disallows dropping requests",
        [ReviewableRequestsDelete],
        [ReviewableRequestsDelete]
      );

      await masterAccess.grantRoles(USER1, [ReviewableRequestsRole]);

      const description = "Updated description";

      let tx = await masterAccess.updateRolePermissions(
        ReviewableRequestsRole,
        description,
        [],
        [ReviewableRequestsDelete],
        [ConstantsRegistryCreate],
        []
      );
      const receipt = await tx.wait();

      if (receipt) {
        expect(receipt.logs[0].fragment.name).to.be.equal("RemovedPermissions");
        expect(receipt.logs[1].fragment.name).to.be.equal("AddedPermissions");
        expect(receipt.logs[2].fragment.name).to.be.equal(
          "AddedRoleWithDescription"
        );
        expect(receipt.logs[2].args.role).to.be.equal(ReviewableRequestsRole);
        expect(receipt.logs[2].args.description).to.be.equal(description);
      }
      expect(await masterAccess.hasReviewableRequestsDeletePermission(USER1)).to
        .be.true;
      expect(await masterAccess.hasConstantsRegistryCreatePermission(USER1)).to
        .be.true;
    });
  });

  describe("updateUserRoles", () => {
    it("should update user roles", async () => {
      await masterAccess.addPermissionsToRole(
        MasterContractsRegistryRole,
        [MasterContractsRegistryCreate],
        true
      );
      await masterAccess.addPermissionsToRole(
        ConstantsRegistryRole,
        [ConstantsRegistryCreate],
        true
      );

      await masterAccess.grantRoles(USER1, [MasterContractsRegistryRole]);

      expect(
        await masterAccess.hasMasterContractsRegistryCreatePermission(USER1)
      ).to.be.true;

      await masterAccess.updateUserRoles(
        USER1,
        [MasterContractsRegistryRole],
        [ConstantsRegistryRole]
      );

      expect(
        await masterAccess.hasMasterContractsRegistryCreatePermission(USER1)
      ).to.be.false;
      expect(await masterAccess.hasConstantsRegistryCreatePermission(USER1)).to
        .be.true;
    });
  });
});
